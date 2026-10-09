from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.db.models import Donation, User
from app.services.matching_engine import match_donation_to_recipients
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/donation/{donation_id}")
async def get_matches_for_donation(
    donation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Donation)
        .filter(Donation.id == donation_id)
        .options(selectinload(Donation.food_items))
    )
    donation = result.scalars().first()
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found")
        
    matches = await match_donation_to_recipients(db, donation)
    return {"donation_id": donation_id, "matches": matches}
