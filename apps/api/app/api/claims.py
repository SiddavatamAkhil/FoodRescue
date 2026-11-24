import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from app.db.session import get_db
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from app.db.models import (
    User, Donation, DonationStatus, Organization, VerificationStatus, Membership, AuditLog, OrgType,
    FoodItem, Notification, PickupTask
)
from app.api.deps import get_current_user, is_org_member, verify_org_membership
from app.schemas.donation import DonationResponse

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

    # Only members of the claiming organization (or operations staff) may claim on its behalf.
    if not await is_org_member(db, current_user, org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not belong to this organization."
        )
    if org.type != OrgType.RECIPIENT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only recipient organizations can claim donations.")

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

    # Test 4: Recipient lacks capacity. Compare today's claimed quantity plus this
    # donation against the organization's declared daily capacity (meals/day).
    if org.daily_capacity is not None:
        items_res = await db.execute(select(func.coalesce(func.sum(FoodItem.quantity), 0.0)).filter(FoodItem.donation_id == donation_id))
        this_qty = float(items_res.scalar() or 0.0)
        start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_res = await db.execute(
            select(func.coalesce(func.sum(FoodItem.quantity), 0.0))
            .join(Donation, Donation.id == FoodItem.donation_id)
            .filter(Donation.claimed_by_org_id == org_id, Donation.updated_at >= start_of_day)
        )
        claimed_today = float(today_res.scalar() or 0.0)
        if org.daily_capacity <= 0 or claimed_today + this_qty > org.daily_capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Error: Recipient organization does not have sufficient daily capacity to handle this donation."
            )

    # Concurrency safe update
    donation.status = DonationStatus.CLAIMED
    donation.claimed_by_org_id = org_id
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

    db.add(Notification(
        id=str(uuid.uuid4()), user_id=donation.creator_id, type="DONATION_CLAIMED",
        title="Donation claimed",
        message=f"'{donation.title}' was claimed by {org.name}. A volunteer pickup will be arranged.",
    ))

    await db.commit()
    return {"message": "Donation claimed successfully", "donation_id": donation_id, "status": "CLAIMED"}


@router.get("/organization/{org_id}")
async def list_claims(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    """Donations claimed by a recipient organization, newest first, with pickup progress."""
    res = await db.execute(
        select(Donation)
        .filter(Donation.claimed_by_org_id == org_id)
        .options(selectinload(Donation.food_items), selectinload(Donation.organization), selectinload(Donation.pickup_tasks))
        .order_by(Donation.updated_at.desc())
    )
    out = []
    for d in res.scalars().all():
        payload = DonationResponse.model_validate(d, from_attributes=True).model_dump()
        payload["donor_name"] = d.organization.name if d.organization else None
        task = d.pickup_tasks[-1] if d.pickup_tasks else None
        payload["pickup"] = (
            {"status": task.status, "picked_up_at": task.picked_up_at, "delivered_at": task.delivered_at,
             "delivery_token": task.delivery_token if task.status == "PICKED_UP" or task.status == "ASSIGNED" else None}
            if task else None
        )
        out.append(payload)
    return out
