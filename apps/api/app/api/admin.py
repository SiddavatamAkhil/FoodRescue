import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import (
    User, UserRole, Organization, Membership, OrgRole, OrgType, VerificationStatus, Donation, DonationStatus, AuditLog
)
from app.api.deps import RoleChecker
from app.core.security import hash_password

router = APIRouter()

@router.get("/dashboard-queues")
async def get_admin_dashboard(
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns active operational queues for Operations Managers and Admins.
    """
    # Active, unclaimed donations
    pub_res = await db.execute(select(Donation).filter(Donation.status == DonationStatus.PUBLISHED))
    active_queue = pub_res.scalars().all()

    # Expiring/at-risk donations (unclaimed & within next 2 hours)
    at_risk_res = await db.execute(
        select(Donation).filter(
            Donation.status == DonationStatus.PUBLISHED,
            Donation.pickup_deadline <= datetime.utcnow() + timedelta(hours=2),
            Donation.pickup_deadline > datetime.utcnow()
        )
    )
    at_risk_queue = at_risk_res.scalars().all()

    # Pending verifications queue
    ver_res = await db.execute(select(Organization).filter(Organization.verification_status == VerificationStatus.PENDING))
    verification_queue = ver_res.scalars().all()

    # Fetch audit logs
    audit_res = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20))
    recent_audit_logs = audit_res.scalars().all()

    return {
        "active_donations_count": len(active_queue),
        "at_risk_donations_count": len(at_risk_queue),
        "pending_verifications_count": len(verification_queue),
        "pending_verifications": [
            {"id": o.id, "name": o.name, "type": o.type, "address": o.address} for o in verification_queue
        ],
        "recent_audit_logs": [
            {"id": a.id, "action": a.action, "resource": a.resource, "timestamp": a.timestamp} for a in recent_audit_logs
        ]
    }

@router.post("/seed-demo", status_code=status.HTTP_201_CREATED)
async def seed_demo_data(
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Seeds database with robust, distinctly labeled demo records (is_demo = true).
    """
    # Clear existing demo records first to make seeding idempotent
    # In SQLite or Postgres, we can delete easily
    
    existing = await db.execute(select(User).filter(User.id == "demo_donor_u"))
    if existing.scalars().first():
        return {"message": "Demo data already present. All demo records are tagged as is_demo = true."}

    from app.db.models import FoodItem

    # 1. Create Demo Users (onboarded and confirmed, so they open straight into their workspaces)
    u1 = User(id="demo_donor_u", email="demo_donor@foodrescue.org", hashed_password=hash_password("demopassword123"), full_name="DEMO Restaurant Owner", role=UserRole.DONOR, onboarding_completed=True, email_verified=True)
    u2 = User(id="demo_ngo_u", email="demo_ngo@foodrescue.org", hashed_password=hash_password("demopassword123"), full_name="DEMO NGO Representative", role=UserRole.RECIPIENT, onboarding_completed=True, email_verified=True)

    # 2. Create Demo Orgs (is_demo = True)
    o1 = Organization(id="demo_donor_o", name="DEMO Nellore Biryani Point", type=OrgType.DONOR, address="Nellore, AP", latitude=14.4426, longitude=79.9865, verification_status=VerificationStatus.VERIFIED, is_demo=True,
                      profile={"city": "Nellore", "business_category": "Restaurant", "food_categories": ["cooked_veg", "cooked_non_veg"], "branches": []})
    o2 = Organization(id="demo_ngo_o", name="DEMO Andhra Food Aid", type=OrgType.RECIPIENT, address="Nellore, AP", latitude=14.4450, longitude=79.9890, verification_status=VerificationStatus.VERIFIED, is_demo=True,
                      daily_capacity=200, profile={"city": "Nellore", "food_categories": ["cooked_veg", "cooked_non_veg", "dry_rations"]})

    # Memberships
    m1 = Membership(id="demo_m1", user_id="demo_donor_u", organization_id="demo_donor_o", role=OrgRole.ADMIN)
    m2 = Membership(id="demo_m2", user_id="demo_ngo_u", organization_id="demo_ngo_o", role=OrgRole.ADMIN)

    # 3. Create Demo Donation (is_demo = True)
    now = datetime.utcnow()
    d1 = Donation(
        id="demo_donation_1",
        organization_id="demo_donor_o",
        creator_id="demo_donor_u",
        title="DEMO 50 Servings Veg Sambar Rice",
        status=DonationStatus.PUBLISHED,
        latitude=14.4426,
        longitude=79.9865,
        pickup_address="Nellore Center AP",
        pickup_deadline=now + timedelta(hours=3),
        is_demo=True,
        state_history=[{"status": "PUBLISHED", "timestamp": now.isoformat(), "actor": "demo_donor_u"}],
    )
    f1 = FoodItem(id="demo_item_1", donation_id="demo_donation_1", name="Veg sambar rice", quantity=50, unit="meals", is_veg=True,
                  prep_time=now - timedelta(hours=1), expiry_time=now + timedelta(hours=6), is_leftover=False)

    db.add_all([u1, u2, o1, o2])
    await db.flush()
    db.add_all([m1, m2, d1])
    await db.flush()
    db.add(f1)
    await db.commit()
    return {"message": "Demo data seeded successfully. All demo records are tagged as is_demo = true."}


# ---------------------------------------------------------------------------
# Management listings
# ---------------------------------------------------------------------------
from typing import Optional as _Optional
from fastapi import HTTPException as _HTTPException
from sqlalchemy import func as _func, or_ as _or
from sqlalchemy.orm import selectinload as _selectinload
from app.db.models import ContactMessage, OrganizationDocument, Volunteer, FoodItem

_staff = RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])


def _page(limit: int, offset: int) -> tuple[int, int]:
    return min(max(limit, 1), 200), max(offset, 0)


@router.get("/users")
async def list_users(
    q: _Optional[str] = None,
    role: _Optional[UserRole] = None,
    limit: int = 25,
    offset: int = 0,
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    limit, offset = _page(limit, offset)
    base = select(User)
    if q:
        like = f"%{q.lower()}%"
        base = base.filter(_or(_func.lower(User.email).like(like), _func.lower(User.full_name).like(like)))
    if role:
        base = base.filter(User.role == role)
    total = (await db.execute(select(_func.count()).select_from(base.subquery()))).scalar() or 0
    res = await db.execute(base.order_by(User.created_at.desc()).limit(limit).offset(offset))
    return {
        "total": total,
        "items": [
            {
                "id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value,
                "phone": u.phone, "is_active": u.is_active, "email_verified": u.email_verified,
                "onboarding_completed": u.onboarding_completed, "created_at": u.created_at,
                "last_login_at": u.last_login_at,
            }
            for u in res.scalars().all()
        ],
    }


@router.post("/users/{user_id}/active")
async def set_user_active(
    user_id: str,
    active: bool,
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise _HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    res = await db.execute(select(User).filter(User.id == user_id))
    user = res.scalars().first()
    if not user:
        raise _HTTPException(status_code=404, detail="User not found")
    user.is_active = active
    db.add(AuditLog(
        id=str(uuid.uuid4()), actor_id=current_user.id,
        action="ACTIVATE_USER" if active else "DEACTIVATE_USER", resource="users",
        after_value={"id": user_id, "is_active": active},
    ))
    await db.commit()
    return {"id": user_id, "is_active": active}


@router.get("/organizations")
async def list_organizations(
    status_filter: _Optional[VerificationStatus] = None,
    org_type: _Optional[OrgType] = None,
    q: _Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    limit, offset = _page(limit, offset)
    base = select(Organization)
    if status_filter:
        base = base.filter(Organization.verification_status == status_filter)
    if org_type:
        base = base.filter(Organization.type == org_type)
    if q:
        base = base.filter(_func.lower(Organization.name).like(f"%{q.lower()}%"))
    total = (await db.execute(select(_func.count()).select_from(base.subquery()))).scalar() or 0
    res = await db.execute(
        base.options(_selectinload(Organization.documents)).order_by(Organization.created_at.desc()).limit(limit).offset(offset)
    )
    return {
        "total": total,
        "items": [
            {
                "id": o.id, "name": o.name, "type": o.type.value, "verification_status": o.verification_status.value,
                "verification_notes": o.verification_notes, "address": o.address, "fssai_number": o.fssai_number,
                "ngo_darpan_id": o.ngo_darpan_id, "daily_capacity": o.daily_capacity, "profile": o.profile or {},
                "is_demo": o.is_demo, "created_at": o.created_at,
                "documents": [
                    {"id": d.id, "document_type": d.document_type, "status": d.status.value, "created_at": d.created_at}
                    for d in o.documents
                ],
            }
            for o in res.scalars().all()
        ],
    }


@router.get("/donations")
async def list_all_donations(
    status_filter: _Optional[DonationStatus] = None,
    q: _Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    limit, offset = _page(limit, offset)
    base = select(Donation)
    if status_filter:
        base = base.filter(Donation.status == status_filter)
    if q:
        base = base.filter(_func.lower(Donation.title).like(f"%{q.lower()}%"))
    total = (await db.execute(select(_func.count()).select_from(base.subquery()))).scalar() or 0
    res = await db.execute(
        base.options(_selectinload(Donation.food_items), _selectinload(Donation.organization))
        .order_by(Donation.created_at.desc()).limit(limit).offset(offset)
    )
    return {
        "total": total,
        "items": [
            {
                "id": d.id, "title": d.title, "status": d.status.value, "pickup_address": d.pickup_address,
                "pickup_deadline": d.pickup_deadline, "created_at": d.created_at, "is_demo": d.is_demo,
                "donor_name": d.organization.name if d.organization else None,
                "claimed_by_org_id": d.claimed_by_org_id,
                "quantity": sum(i.quantity for i in d.food_items),
                "unit": d.food_items[0].unit if d.food_items else None,
            }
            for d in res.scalars().all()
        ],
    }


@router.get("/audit-logs")
async def list_audit_logs(
    action: _Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    limit, offset = _page(limit, offset)
    base = select(AuditLog)
    if action:
        base = base.filter(AuditLog.action == action)
    total = (await db.execute(select(_func.count()).select_from(base.subquery()))).scalar() or 0
    res = await db.execute(base.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset))
    logs = res.scalars().all()
    actor_ids = {a.actor_id for a in logs if a.actor_id}
    names = {}
    if actor_ids:
        ures = await db.execute(select(User.id, User.email).filter(User.id.in_(actor_ids)))
        names = {i: e for i, e in ures.all()}
    return {
        "total": total,
        "items": [
            {
                "id": a.id, "action": a.action, "resource": a.resource, "timestamp": a.timestamp,
                "actor_email": names.get(a.actor_id), "before": a.before_value, "after": a.after_value,
                "ip_address": a.ip_address,
            }
            for a in logs
        ],
    }


@router.get("/contact-messages")
async def list_contact_messages(
    limit: int = 50,
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(min(limit, 200)))
    return [
        {"id": m.id, "name": m.name, "email": m.email, "organization": m.organization, "topic": m.topic,
         "message": m.message, "created_at": m.created_at}
        for m in res.scalars().all()
    ]


@router.get("/overview")
async def admin_overview(
    current_user: User = Depends(_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.db.models import Incident

    now = datetime.utcnow()
    async def count(stmt):
        return (await db.execute(stmt)).scalar() or 0

    pending = await count(select(_func.count(Organization.id)).filter(
        Organization.verification_status.in_([VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW])))
    active_ops = await count(select(_func.count(Donation.id)).filter(Donation.status.in_([
        DonationStatus.CLAIMED, DonationStatus.PICKUP_ASSIGNED, DonationStatus.PICKED_UP])))
    published = await count(select(_func.count(Donation.id)).filter(
        Donation.status == DonationStatus.PUBLISHED, Donation.pickup_deadline > now))
    at_risk = await count(select(_func.count(Donation.id)).filter(
        Donation.status == DonationStatus.PUBLISHED,
        Donation.pickup_deadline <= now + timedelta(hours=2), Donation.pickup_deadline > now))
    open_incidents = await count(select(_func.count(Incident.id)).filter(Incident.status != "RESOLVED"))
    users = await count(select(_func.count(User.id)))
    orgs = await count(select(_func.count(Organization.id)))
    completed = await count(select(_func.count(Donation.id)).filter(Donation.status == DonationStatus.COMPLETED))
    return {
        "pending_verifications": pending,
        "active_operations": active_ops,
        "open_listings": published,
        "at_risk_listings": at_risk,
        "open_incidents": open_incidents,
        "total_users": users,
        "total_organizations": orgs,
        "completed_rescues": completed,
    }


@router.get("/system")
async def system_settings(current_user: User = Depends(_staff)):
    """Read-only view of operational configuration. Secrets are never returned."""
    from app.core.config import settings
    from app.services.matching_engine import MATCH_CONFIG

    return {
        "environment": settings.ENVIRONMENT,
        "jurisdiction": settings.DEFAULT_JURISDICTION,
        "session_minutes": settings.SESSION_EXPIRE_MINUTES,
        "remember_me_days": settings.REMEMBER_ME_EXPIRE_DAYS,
        "login_max_failures": settings.LOGIN_MAX_FAILURES,
        "login_window_minutes": settings.LOGIN_WINDOW_SECONDS // 60,
        "email_delivery": "smtp" if settings.SMTP_HOST else "server_log",
        "sms_provider": settings.SMS_PROVIDER,
        "max_upload_mb": settings.MAX_UPLOAD_MB,
        "matching": MATCH_CONFIG,
    }
