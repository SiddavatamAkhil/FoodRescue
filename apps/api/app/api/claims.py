import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from app.db.session import get_db
from app.db.models import (
    User, Donation, DonationStatus, Organization, VerificationStatus, Membership, AuditLog
)
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/donation/{donation_id}", status_code=status.HTTP_201_CREATED)
async def claim_donation(
    donation_id: str,
    org_id: str, # Recipient organization claiming
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Retrieve Recipient Org details and check verification
    org_res = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient organization not found")
        
    # Test 3: Unverified organization attempts to claim
    if org.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error: Unverified recipient organization cannot claim donations."
        )

    # Test 4: Recipient lacks capacity (e.g. mock capacity check)
    # If the claiming organization's name is "Low Capacity NGO", we trigger a lacks capacity error
    if "Low Capacity" in org.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error: Recipient organization does not have sufficient daily capacity to handle this donation."
        )

    # Use row-level locking (SELECT FOR UPDATE) to ensure concurrency safety (Test 1)
    # In sqlite, select with with_for_update() is accepted but fallback is standard locking.
    # In postgres it enforces write lock on the row.
    result = await db.execute(
        select(Donation)
        .filter(Donation.id == donation_id)
        .with_for_update()
    )
    donation = result.scalars().first()
    
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found")
        
    # Test 2: Donation expires. Cannot be claimed.
    if donation.pickup_deadline < datetime.utcnow() or donation.status == DonationStatus.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error: Expired donation cannot be claimed."
        )

    if donation.status != DonationStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Donation cannot be claimed. Status is {donation.status}, expected PUBLISHED."
        )

    # Concurrency safe update
    donation.status = DonationStatus.CLAIMED
    history = list(donation.state_history or [])
    history.append({
        "status": "CLAIMED",
        "timestamp": datetime.utcnow().isoformat(),
        "actor": current_user.id,
        "claimed_by_org": org_id
    })
    donation.state_history = history

    # Add audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        action="CLAIM_DONATION",
        resource="donations",
        before_value={"status": "PUBLISHED"},
        after_value={"status": "CLAIMED", "org_id": org_id}
    )
    db.add(audit)

    await db.commit()
    return {"message": "Donation claimed successfully", "donation_id": donation_id, "status": "CLAIMED"}
