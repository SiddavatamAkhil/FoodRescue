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
