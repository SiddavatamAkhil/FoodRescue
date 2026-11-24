import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, is_org_member, is_staff
from app.db.models import (
    AuditLog,
    CustodyEvent,
    CustodyEventType,
    Donation,
    DonationStatus,
    Notification,
    Organization,
    PickupTask,
    User,
    UserRole,
    Volunteer,
)
from app.db.session import get_db
from app.services.matching_engine import haversine_distance

router = APIRouter()


def _new_code(prefix: str) -> str:
    # Cryptographically secure, single-use custody code.
    return f"{prefix}_{secrets.token_hex(16)}"


async def _volunteer_for(db: AsyncSession, user: User) -> Optional[Volunteer]:
    res = await db.execute(select(Volunteer).filter(Volunteer.user_id == user.id))
    return res.scalars().first()


async def _create_task(db: AsyncSession, donation: Donation, volunteer_ref: str, actor: User) -> PickupTask:
    task = PickupTask(
        id=str(uuid.uuid4()),
        donation_id=donation.id,
        volunteer_id=volunteer_ref,
        status="ASSIGNED",
        qr_token=_new_code("qr_token"),
        delivery_token=_new_code("dlv_token"),
    )
    db.add(task)
    donation.status = DonationStatus.PICKUP_ASSIGNED
    history = list(donation.state_history or [])
    history.append({
        "status": "PICKUP_ASSIGNED",
        "timestamp": datetime.utcnow().isoformat(),
        "actor": actor.id,
        "volunteer_id": volunteer_ref,
    })
    donation.state_history = history
    db.add(AuditLog(
        id=str(uuid.uuid4()), actor_id=actor.id, action="ASSIGN_PICKUP", resource="donations",
        after_value={"donation_id": donation.id, "task_id": task.id},
    ))
    return task


@router.post("/assign/{donation_id}", status_code=status.HTTP_201_CREATED)
async def assign_pickup(
    donation_id: str,
    volunteer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a volunteer. Allowed for operations staff and the claiming recipient organization."""
    result = await db.execute(select(Donation).filter(Donation.id == donation_id))
    donation = result.scalars().first()
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found")

    if not is_staff(current_user):
        if not donation.claimed_by_org_id or not await is_org_member(db, current_user, donation.claimed_by_org_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the claiming organization can assign a pickup.")

    if donation.status != DonationStatus.CLAIMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign volunteer. Donation status is {donation.status}, expected CLAIMED.",
        )

    # Accept either a volunteer profile id or the volunteer's user id.
    vol_res = await db.execute(
        select(Volunteer).filter((Volunteer.id == volunteer_id) | (Volunteer.user_id == volunteer_id))
    )
    vol = vol_res.scalars().first()
    if vol is None:
        user_res = await db.execute(select(User).filter(User.id == volunteer_id, User.role == UserRole.VOLUNTEER))
        vol_user = user_res.scalars().first()
        if vol_user is None:
            raise HTTPException(status_code=404, detail="Volunteer not found.")
        # Volunteer hasn't completed onboarding yet: create the profile the task must reference.
        vol = Volunteer(id=str(uuid.uuid4()), user_id=vol_user.id, is_available=True)
        db.add(vol)
        await db.flush()
    task = await _create_task(db, donation, vol.id, current_user)
    # Keep the caller-supplied identifier in the history for traceability.
    history = list(donation.state_history)
    history[-1] = {**history[-1], "volunteer_id": volunteer_id}
    donation.state_history = history
    await db.commit()
    return {
        "message": "Pickup task assigned",
        "task_id": task.id,
        "qr_token": task.qr_token,
        "delivery_token": task.delivery_token,
    }


@router.get("/available")
async def available_pickups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claimed donations that still need a volunteer, nearest first."""
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can browse pickup tasks.")
    vol = await _volunteer_for(db, current_user)
    res = await db.execute(
        select(Donation)
        .filter(Donation.status == DonationStatus.CLAIMED, Donation.pickup_deadline > datetime.utcnow())
        .options(selectinload(Donation.food_items), selectinload(Donation.organization))
        .order_by(Donation.pickup_deadline.asc())
    )
    donations = res.scalars().all()
    org_ids = {d.claimed_by_org_id for d in donations if d.claimed_by_org_id}
    orgs = {}
    if org_ids:
        org_res = await db.execute(select(Organization).filter(Organization.id.in_(org_ids)))
        orgs = {o.id: o for o in org_res.scalars().all()}
    out = []
    for d in donations:
        dest = orgs.get(d.claimed_by_org_id)
        dist = None
        if vol and vol.latitude is not None and vol.longitude is not None:
            dist = round(haversine_distance(vol.latitude, vol.longitude, d.latitude, d.longitude), 1)
        out.append({
            "donation_id": d.id,
            "title": d.title,
            "pickup_address": d.pickup_address,
            "pickup_latitude": d.latitude,
            "pickup_longitude": d.longitude,
            "pickup_deadline": d.pickup_deadline,
            "donor_name": d.organization.name if d.organization else None,
            "dropoff_name": dest.name if dest else None,
            "dropoff_address": dest.address if dest else None,
            "dropoff_latitude": dest.latitude if dest else None,
            "dropoff_longitude": dest.longitude if dest else None,
            "quantity": sum(i.quantity for i in d.food_items),
            "unit": d.food_items[0].unit if d.food_items else None,
            "distance_km": dist,
        })
    if vol and vol.latitude is not None:
        out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    return {"profile_complete": vol is not None, "tasks": out}


@router.post("/accept/{donation_id}", status_code=status.HTTP_201_CREATED)
async def accept_pickup(
    donation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A volunteer takes on a claimed donation. Row lock prevents two volunteers taking the same task."""
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only volunteers can accept pickup tasks.")
    vol = await _volunteer_for(db, current_user)
    if vol is None:
        raise HTTPException(status_code=400, detail="Complete your volunteer profile before accepting tasks.")
    res = await db.execute(select(Donation).filter(Donation.id == donation_id).with_for_update())
    donation = res.scalars().first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status != DonationStatus.CLAIMED:
        raise HTTPException(status_code=400, detail="This pickup is no longer available.")
    if donation.pickup_deadline <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="The pickup deadline for this donation has passed.")
    task = await _create_task(db, donation, vol.id, current_user)
    db.add(Notification(
        id=str(uuid.uuid4()), user_id=donation.creator_id, type="PICKUP_ASSIGNED",
        title="Volunteer assigned",
        message=f"{current_user.full_name} will collect '{donation.title}'. Show them the pickup code at handover.",
    ))
    await db.commit()
    return {"message": "Pickup accepted", "task_id": task.id}


@router.get("/mine")
async def my_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The volunteer's own tasks. Custody codes are never returned to the volunteer."""
    vol = await _volunteer_for(db, current_user)
    refs = [current_user.id] + ([vol.id] if vol else [])
    res = await db.execute(
        select(PickupTask)
        .filter(PickupTask.volunteer_id.in_(refs))
        .options(selectinload(PickupTask.donation).selectinload(Donation.food_items),
                 selectinload(PickupTask.donation).selectinload(Donation.organization))
        .order_by(PickupTask.created_at.desc())
    )
    tasks = res.scalars().all()
    org_ids = {t.donation.claimed_by_org_id for t in tasks if t.donation and t.donation.claimed_by_org_id}
    orgs = {}
    if org_ids:
        org_res = await db.execute(select(Organization).filter(Organization.id.in_(org_ids)))
        orgs = {o.id: o for o in org_res.scalars().all()}
    out = []
    for t in tasks:
        d = t.donation
        dest = orgs.get(d.claimed_by_org_id) if d else None
        out.append({
            "task_id": t.id,
            "status": t.status,
            "created_at": t.created_at,
            "picked_up_at": t.picked_up_at,
            "delivered_at": t.delivered_at,
            "donation_id": d.id if d else None,
            "title": d.title if d else None,
            "pickup_address": d.pickup_address if d else None,
            "pickup_latitude": d.latitude if d else None,
            "pickup_longitude": d.longitude if d else None,
            "pickup_deadline": d.pickup_deadline if d else None,
            "donor_name": d.organization.name if d and d.organization else None,
            "dropoff_name": dest.name if dest else None,
            "dropoff_address": dest.address if dest else None,
            "dropoff_latitude": dest.latitude if dest else None,
            "dropoff_longitude": dest.longitude if dest else None,
            "quantity": sum(i.quantity for i in d.food_items) if d else 0,
            "unit": d.food_items[0].unit if d and d.food_items else None,
        })
    return out


@router.get("/donation/{donation_id}")
async def donation_pickup(
    donation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pickup status for the donor or recipient. The donor sees the pickup code; the recipient sees the delivery code."""
    res = await db.execute(
        select(Donation).filter(Donation.id == donation_id).options(selectinload(Donation.pickup_tasks))
    )
    donation = res.scalars().first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    is_donor = await is_org_member(db, current_user, donation.organization_id)
    is_recipient = bool(donation.claimed_by_org_id) and await is_org_member(db, current_user, donation.claimed_by_org_id)
    if not (is_donor or is_recipient):
        raise HTTPException(status_code=403, detail="Access denied")
    task = donation.pickup_tasks[-1] if donation.pickup_tasks else None
    if not task:
        return {"donation_id": donation_id, "task": None}
    volunteer_name = None
    if task.volunteer_id:
        v_res = await db.execute(
            select(User).join(Volunteer, Volunteer.user_id == User.id).filter(Volunteer.id == task.volunteer_id)
        )
        u = v_res.scalars().first()
        if u is None:
            u_res = await db.execute(select(User).filter(User.id == task.volunteer_id))
            u = u_res.scalars().first()
        volunteer_name = u.full_name if u else None
    staff = is_staff(current_user)
    return {
        "donation_id": donation_id,
        "task": {
            "id": task.id,
            "status": task.status,
            "volunteer_name": volunteer_name,
            "created_at": task.created_at,
            "picked_up_at": task.picked_up_at,
            "delivered_at": task.delivered_at,
            "pickup_code": task.qr_token if (is_donor and not staff and task.status == "ASSIGNED") else None,
            "delivery_code": task.delivery_token if (is_recipient and not staff and task.status in ("ASSIGNED", "PICKED_UP")) else None,
        },
    }


@router.post("/verify-handoff", status_code=status.HTTP_200_OK)
async def verify_handoff(
    qr_token: str,
    event_type: CustodyEventType,  # HANDOFF (PICKUP) or DELIVERY
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    qr_token = qr_token.strip()
    # Pickup uses the donor's code. Delivery uses the recipient's code; tasks created before
    # delivery codes existed fall back to the pickup code.
    task_res = await db.execute(
        select(PickupTask).filter((PickupTask.qr_token == qr_token) | (PickupTask.delivery_token == qr_token))
    )
    task = task_res.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification failed: Invalid or expired QR token.")

    is_delivery = event_type == CustodyEventType.DELIVERY
    if is_delivery and task.delivery_token and qr_token != task.delivery_token:
        raise HTTPException(status_code=400, detail="This is the pickup code. Ask the receiving organization for its delivery code.")
    if not is_delivery and qr_token != task.qr_token:
        raise HTTPException(status_code=400, detail="This is the delivery code. Ask the donor for the pickup code.")

    if current_user.role == UserRole.VOLUNTEER:
        vol = await _volunteer_for(db, current_user)
        if task.volunteer_id not in [current_user.id, vol.id if vol else None]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Error: Unauthorized volunteer access. This task is assigned to another rescuer.",
            )

    if event_type in [CustodyEventType.PICKUP, CustodyEventType.HANDOFF]:
        if task.status != "ASSIGNED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Error: Handoff scanned at wrong stage. Current status is {task.status}, expected ASSIGNED. reused QR rejected.",
            )
    elif is_delivery and task.status != "PICKED_UP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Error: Delivery scanned at wrong stage. Current status is {task.status}, expected PICKED_UP.",
        )

    existing_event = await db.execute(
        select(CustodyEvent).filter(CustodyEvent.qr_token == qr_token, CustodyEvent.event_type == event_type)
    )
    if existing_event.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Error: This custody stage {event_type.value} has already been verified. reused token rejected.",
        )

    donation_res = await db.execute(select(Donation).filter(Donation.id == task.donation_id))
    donation = donation_res.scalars().first()
    now = datetime.utcnow()
    db.add(CustodyEvent(
        id=str(uuid.uuid4()), donation_id=task.donation_id, event_type=event_type,
        actor_id=current_user.id, qr_token=qr_token, timestamp=now,
    ))

    history = list(donation.state_history or [])
    if event_type in [CustodyEventType.PICKUP, CustodyEventType.HANDOFF]:
        task.status = "PICKED_UP"
        task.picked_up_at = now
        donation.status = DonationStatus.PICKED_UP
        history.append({"status": "PICKED_UP", "timestamp": now.isoformat(), "actor": current_user.id})
    else:
        task.status = "DELIVERED"
        task.delivered_at = now
        donation.status = DonationStatus.COMPLETED
        history.append({"status": "COMPLETED", "timestamp": now.isoformat(), "actor": current_user.id})
        db.add(Notification(
            id=str(uuid.uuid4()), user_id=donation.creator_id, type="DONATION_COMPLETED",
            title="Rescue completed", message=f"'{donation.title}' was delivered and confirmed by the recipient.",
        ))
    donation.state_history = history

    db.add(AuditLog(
        id=str(uuid.uuid4()), actor_id=current_user.id, action=f"CUSTODY_{event_type.name}",
        resource="pickup_tasks", after_value={"donation_id": task.donation_id, "task_id": task.id},
    ))
    await db.commit()
    return {"message": f"Custody {event_type.name} successfully verified", "donation_id": task.donation_id}
