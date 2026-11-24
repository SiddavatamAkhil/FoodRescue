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
from typing import List, Optional
from sqlalchemy import or_
from app.api.deps import get_current_user, verify_org_membership, is_org_member, get_user_organization, is_staff
from app.services.matching_engine import haversine_distance

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
    if org.type not in (OrgType.DONOR, OrgType.CORPORATE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only food donor and corporate organizations can list donations.",
        )
    
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

@router.get("/", response_model=List[DonationResponse])
async def list_organization_donations(
    org_id: str,
    status_filter: Optional[DonationStatus] = None,
    limit: int = 200,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = Depends(verify_org_membership)
):
    """Donations listed by the given organization (donor view)."""
    q = (
        select(Donation)
        .filter(Donation.organization_id == org_id)
        .options(selectinload(Donation.food_items))
        .order_by(Donation.created_at.desc())
        .limit(min(max(limit, 1), 500))
    )
    if status_filter:
        q = q.filter(Donation.status == status_filter)
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/available")
async def list_available_donations(
    max_distance_km: float = 50.0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Published, unexpired listings near the caller's recipient organization."""
    org = await get_user_organization(db, current_user)
    if org is None or org.type != OrgType.RECIPIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only recipient organizations can browse donations.")
    now = datetime.utcnow()
    res = await db.execute(
        select(Donation)
        .filter(Donation.status == DonationStatus.PUBLISHED, Donation.pickup_deadline > now)
        .options(selectinload(Donation.food_items), selectinload(Donation.organization))
        .order_by(Donation.pickup_deadline.asc())
    )
    out = []
    for d in res.scalars().all():
        dist = haversine_distance(org.latitude, org.longitude, d.latitude, d.longitude)
        if dist > max_distance_km:
            continue
        payload = DonationResponse.model_validate(d, from_attributes=True).model_dump()
        payload["distance_km"] = round(dist, 1)
        payload["donor_name"] = d.organization.name if d.organization else None
        out.append(payload)
    return {"organization_verified": org.verification_status == VerificationStatus.VERIFIED, "donations": out}


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

    # Only the listing organization (or operations staff) may publish or cancel a listing.
    if new_status in (DonationStatus.PUBLISHED, DonationStatus.CANCELLED):
        if not await is_org_member(db, current_user, donation.organization_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif not is_staff(current_user):
        allowed_orgs = [donation.organization_id] + ([donation.claimed_by_org_id] if donation.claimed_by_org_id else [])
        if not any([await is_org_member(db, current_user, o) for o in allowed_orgs]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if new_status == DonationStatus.PUBLISHED and donation.pickup_deadline <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing's pickup deadline has passed. Create a new listing instead.",
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
