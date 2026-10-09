import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.db.models import (
    User, UserRole, Donation, FoodItem, DonationStatus, AuditLog, Organization, Membership, OrgType, VerificationStatus
)
from app.schemas.donation import DonationCreate, DonationResponse, DonationTransition
from app.api.deps import get_current_user, verify_org_membership

router = APIRouter()

VALID_TRANSITIONS = {
    DonationStatus.DRAFT: [DonationStatus.PUBLISHED, DonationStatus.CANCELLED],
    DonationStatus.PUBLISHED: [DonationStatus.CLAIMED, DonationStatus.EXPIRED, DonationStatus.CANCELLED],
    DonationStatus.CLAIMED: [DonationStatus.PICKUP_ASSIGNED, DonationStatus.PUBLISHED, DonationStatus.FAILED],
    DonationStatus.PICKUP_ASSIGNED: [DonationStatus.PICKED_UP, DonationStatus.CLAIMED, DonationStatus.FAILED],
    DonationStatus.PICKED_UP: [DonationStatus.DELIVERED, DonationStatus.FAILED],
    DonationStatus.DELIVERED: [DonationStatus.COMPLETED, DonationStatus.DISPUTED],
    DonationStatus.COMPLETED: [],
    DonationStatus.CANCELLED: [],
    DonationStatus.EXPIRED: [],
    DonationStatus.DISPUTED: [DonationStatus.COMPLETED, DonationStatus.FAILED],
    DonationStatus.FAILED: []
}

@router.post("/", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
async def create_donation(
    donation_in: DonationCreate,
    org_id: str, # Queried from current organization
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = Depends(verify_org_membership)
):
    # Verify that the organization is verified before publishing (or default to draft)
    res_org = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = res_org.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    
    # Create the donation object in DRAFT state
    donation_id = str(uuid.uuid4())
    new_donation = Donation(
        id=donation_id,
        organization_id=org_id,
        creator_id=current_user.id,
        title=donation_in.title,
        description=donation_in.description,
        status=DonationStatus.DRAFT,
        latitude=donation_in.latitude,
        longitude=donation_in.longitude,
        pickup_address=donation_in.pickup_address,
        pickup_deadline=donation_in.pickup_deadline,
        storage_info=donation_in.storage_info,
        is_demo=org.is_demo,
        state_history=[{"status": "DRAFT", "timestamp": datetime.utcnow().isoformat(), "actor": current_user.id}]
    )
    db.add(new_donation)

    for item in donation_in.food_items:
        new_item = FoodItem(
            id=str(uuid.uuid4()),
            donation_id=donation_id,
            name=item.name,
            quantity=item.quantity,
            unit=item.unit,
            is_veg=item.is_veg,
            prep_time=item.prep_time,
            expiry_time=item.expiry_time,
            is_leftover=item.is_leftover
        )
        db.add(new_item)

    # Write Audit Log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        action="CREATE_DONATION",
        resource="donations",
        after_value={"id": donation_id, "title": donation_in.title, "status": "DRAFT"}
    )
    db.add(audit)

    await db.commit()
    
    # Reload donation with food_items preloaded
    result = await db.execute(
        select(Donation)
        .filter(Donation.id == donation_id)
        .options(selectinload(Donation.food_items))
    )
    return result.scalars().first()

@router.get("/{donation_id}", response_model=DonationResponse)
async def get_donation(
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
        
    # Enforce organization isolation (unless admin/ops)
    if current_user.role not in [UserRole.ADMIN, UserRole.OPS_MANAGER]:
        # Check if user is member of the donor organization
        mem_result = await db.execute(
            select(Membership).filter(
                Membership.user_id == current_user.id,
                Membership.organization_id == donation.organization_id
            )
        )
        if not mem_result.scalars().first():
            # If not donor member, allow read ONLY if donation is published or claimed
            if donation.status not in [DonationStatus.PUBLISHED, DonationStatus.CLAIMED, DonationStatus.PICKUP_ASSIGNED, DonationStatus.PICKED_UP, DonationStatus.DELIVERED, DonationStatus.COMPLETED]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
                
    return donation

@router.post("/{donation_id}/transition", response_model=DonationResponse)
async def transition_donation(
    donation_id: str,
    transition_in: DonationTransition,
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

    old_status = donation.status
    new_status = transition_in.status

    # Validate state machine transitions
    allowed = VALID_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state transition: Cannot transition from {old_status} to {new_status}."
        )

    # Check authorization based on roles
    if new_status == DonationStatus.PUBLISHED:
        # Check if organization is verified
        org_res = await db.execute(select(Organization).filter(Organization.id == donation.organization_id))
        org = org_res.scalars().first()
        if org.verification_status != VerificationStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization must be VERIFIED before publishing donations."
            )

    # Apply transition
    donation.status = new_status
    history = list(donation.state_history or [])
    history.append({
        "status": new_status,
        "timestamp": datetime.utcnow().isoformat(),
        "actor": current_user.id
    })
    donation.state_history = history

    # Add audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        action="TRANSITION_DONATION",
        resource="donations",
        before_value={"status": old_status},
        after_value={"status": new_status}
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(donation)
    return donation
