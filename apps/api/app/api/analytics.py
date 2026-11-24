from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.session import get_db
from app.db.models import Donation, DonationStatus, Organization, User

router = APIRouter()

@router.get("/metrics")
async def get_analytics_metrics(
    db: AsyncSession = Depends(get_db)
):
    """
    Computes real production operational metrics.
    ABSOLUTE MANDATE: Excludes all demo data where is_demo = true.
    """
    # 1. Active real donations (excluding demo)
    real_pub = await db.execute(
        select(func.count(Donation.id)).filter(
            Donation.status == DonationStatus.PUBLISHED,
            Donation.is_demo == False
        )
    )
    active_donations = real_pub.scalar() or 0

    # 2. Completed real donations (excluding demo)
    real_completed = await db.execute(
        select(func.count(Donation.id)).filter(
            Donation.status == DonationStatus.COMPLETED,
            Donation.is_demo == False
        )
    )
    completed_donations = real_completed.scalar() or 0

    # 3. Expired real donations (excluding demo)
    real_expired = await db.execute(
        select(func.count(Donation.id)).filter(
            Donation.status == DonationStatus.EXPIRED,
            Donation.is_demo == False
        )
    )
    expired_donations = real_expired.scalar() or 0

    # 4. Total real registered organizations (excluding demo)
    real_orgs = await db.execute(
        select(func.count(Organization.id)).filter(
            Organization.is_demo == False
        )
    )
    total_organizations = real_orgs.scalar() or 0

    return {
        "production_metrics": {
            "active_donations_unclaimed": active_donations,
            "completed_donations_saved": completed_donations,
            "expired_donations_unclaimed": expired_donations,
            "total_registered_organizations": total_organizations,
            "methodology": "Strict real-time deterministic counting. All demo listings (is_demo=true) are excluded."
        }
    }


# ---------------------------------------------------------------------------
# Organization and platform reporting (computed from recorded donations only)
# ---------------------------------------------------------------------------
from collections import defaultdict as _dd
from datetime import datetime as _dt, timedelta as _td
from fastapi import HTTPException as _HTTPException
from sqlalchemy.orm import selectinload as _selectinload
from app.api.deps import get_current_user, verify_org_membership, RoleChecker
from app.db.models import UserRole, OrgType, Demand, PickupTask, Volunteer

_ACTIVE = {"PUBLISHED", "CLAIMED", "PICKUP_ASSIGNED", "PICKED_UP", "DELIVERED"}


def _month_keys(months: int) -> list[str]:
    now = _dt.utcnow()
    y, m = now.year, now.month
    keys = []
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _summarise(donations, months: int) -> dict:
    keys = _month_keys(months)
    series = {k: {"month": k, "listed": 0.0, "rescued": 0.0, "expired": 0.0, "listings": 0} for k in keys}
    by_status = _dd(int)
    categories = {"veg": 0.0, "non_veg": 0.0}
    weekday = [0.0] * 7
    unit_counts = _dd(int)
    for d in donations:
        status = d.status.value
        by_status[status] += 1
        qty = sum(i.quantity for i in d.food_items)
        for i in d.food_items:
            unit_counts[i.unit] += 1
            categories["veg" if i.is_veg else "non_veg"] += i.quantity
        key = d.created_at.strftime("%Y-%m") if d.created_at else None
        if key in series:
            series[key]["listed"] += qty
            series[key]["listings"] += 1
            if status == "COMPLETED":
                series[key]["rescued"] += qty
            if status == "EXPIRED":
                series[key]["expired"] += qty
        if d.created_at:
            weekday[d.created_at.weekday()] += qty
    finished = by_status.get("COMPLETED", 0) + by_status.get("EXPIRED", 0) + by_status.get("FAILED", 0) + by_status.get("CANCELLED", 0)
    completion_rate = (by_status.get("COMPLETED", 0) / finished) if finished else None
    return {
        "total_listings": len(donations),
        "by_status": dict(by_status),
        "active": sum(v for k, v in by_status.items() if k in _ACTIVE),
        "completed": by_status.get("COMPLETED", 0),
        "completion_rate": completion_rate,
        "quantity_listed": sum(s["listed"] for s in series.values()),
        "quantity_rescued": sum(s["rescued"] for s in series.values()),
        "monthly": list(series.values()),
        "category_split": categories,
        "weekday_quantity": weekday,
        "primary_unit": max(unit_counts, key=unit_counts.get) if unit_counts else "meals",
    }


@router.get("/organization/{org_id}")
async def organization_report(
    org_id: str,
    months: int = 6,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    months = min(max(months, 1), 24)
    org = (await db.execute(select(Organization).filter(Organization.id == org_id))).scalars().first()
    if not org:
        raise _HTTPException(status_code=404, detail="Organization not found")
    field = Donation.claimed_by_org_id if org.type == OrgType.RECIPIENT else Donation.organization_id
    res = await db.execute(select(Donation).filter(field == org_id).options(_selectinload(Donation.food_items)))
    report = _summarise(res.scalars().all(), months)
    report["organization_type"] = org.type.value
    if org.type == OrgType.RECIPIENT:
        dres = await db.execute(select(Demand).filter(Demand.organization_id == org_id))
        demands = dres.scalars().all()
        report["open_demand_quantity"] = sum(d.quantity_needed for d in demands)
        report["daily_capacity"] = org.daily_capacity
    return report


@router.get("/volunteer")
async def volunteer_report(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vol = (await db.execute(select(Volunteer).filter(Volunteer.user_id == current_user.id))).scalars().first()
    refs = [current_user.id] + ([vol.id] if vol else [])
    res = await db.execute(
        select(PickupTask).filter(PickupTask.volunteer_id.in_(refs))
        .options(_selectinload(PickupTask.donation).selectinload(Donation.food_items))
    )
    tasks = res.scalars().all()
    delivered = [t for t in tasks if t.status == "DELIVERED"]
    return {
        "total_tasks": len(tasks),
        "delivered": len(delivered),
        "in_progress": sum(1 for t in tasks if t.status in ("ASSIGNED", "PICKED_UP")),
        "quantity_delivered": sum(sum(i.quantity for i in t.donation.food_items) for t in delivered if t.donation),
    }


@router.get("/platform")
async def platform_report(
    months: int = 6,
    current_user=Depends(RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    months = min(max(months, 1), 24)
    res = await db.execute(
        select(Donation).filter(Donation.is_demo == False).options(_selectinload(Donation.food_items))  # noqa: E712
    )
    return _summarise(res.scalars().all(), months)
