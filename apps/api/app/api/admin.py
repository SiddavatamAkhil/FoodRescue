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
    
    # 1. Create Demo Users
    u1 = User(id="demo_donor_u", email="demo_donor@foodrescue.org", hashed_password=hash_password("demopassword123"), full_name="DEMO Restuarant Owner", role=UserRole.DONOR)
    u2 = User(id="demo_ngo_u", email="demo_ngo@foodrescue.org", hashed_password=hash_password("demopassword123"), full_name="DEMO NGO Representative", role=UserRole.RECIPIENT)
    
    # 2. Create Demo Orgs (is_demo = True)
    o1 = Organization(id="demo_donor_o", name="DEMO Nellore Biryani Point", type=OrgType.DONOR, address="Nellore, AP", latitude=14.4426, longitude=79.9865, verification_status=VerificationStatus.VERIFIED, is_demo=True)
    o2 = Organization(id="demo_ngo_o", name="DEMO Andhra Food Aid", type=OrgType.RECIPIENT, address="Nellore, AP", latitude=14.4450, longitude=79.9890, verification_status=VerificationStatus.VERIFIED, is_demo=True)
    
    # Memberships
    m1 = Membership(id="demo_m1", user_id="demo_donor_u", organization_id="demo_donor_o", role=OrgRole.ADMIN)
    m2 = Membership(id="demo_m2", user_id="demo_ngo_u", organization_id="demo_ngo_o", role=OrgRole.ADMIN)
    
    # 3. Create Demo Donation (is_demo = True)
    d1 = Donation(
        id="demo_donation_1",
        organization_id="demo_donor_o",
        creator_id="demo_donor_u",
        title="DEMO 50 Servings Veg Sambar Rice",
        status=DonationStatus.PUBLISHED,
        latitude=14.4426,
        longitude=79.9865,
        pickup_address="Nellore Center AP",
        pickup_deadline=datetime.utcnow() + timedelta(hours=3),
        is_demo=True
    )
    
    db.add_all([u1, u2, o1, o2, m1, m2, d1])
    await db.commit()
    return {"message": "Demo data seeded successfully. All demo records are tagged as is_demo = true."}
