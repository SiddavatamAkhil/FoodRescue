import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import (
    User, Donation, DonationStatus, PickupTask, CustodyEvent, CustodyEventType, AuditLog, UserRole, Volunteer
)
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/assign/{donation_id}", status_code=status.HTTP_201_CREATED)
async def assign_pickup(
    donation_id: str,
    volunteer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Donation).filter(Donation.id == donation_id))
    donation = result.scalars().first()
    if not donation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found")
        
    if donation.status != DonationStatus.CLAIMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign volunteer. Donation status is {donation.status}, expected CLAIMED."
        )

    # Generate a cryptographically secure, single-use token for verification
    qr_token = f"qr_token_{uuid.uuid4().hex}"

    task_id = str(uuid.uuid4())
    new_task = PickupTask(
        id=task_id,
        donation_id=donation_id,
        volunteer_id=volunteer_id,
        status="ASSIGNED",
        qr_token=qr_token
    )
    db.add(new_task)

    donation.status = DonationStatus.PICKUP_ASSIGNED
    history = list(donation.state_history or [])
    history.append({
        "status": "PICKUP_ASSIGNED",
        "timestamp": datetime.utcnow().isoformat(),
        "actor": current_user.id,
        "volunteer_id": volunteer_id
    })
    donation.state_history = history

    await db.commit()
    return {"message": "Pickup task assigned", "task_id": task_id, "qr_token": qr_token}


@router.post("/verify-handoff", status_code=status.HTTP_200_OK)
async def verify_handoff(
    qr_token: str,
    event_type: CustodyEventType, # HANDOFF (PICKUP) or DELIVERY
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Retrieve matching pickup task
    task_res = await db.execute(
        select(PickupTask).filter(PickupTask.qr_token == qr_token)
    )
    task = task_res.scalars().first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification failed: Invalid or expired QR token."
        )

    # Verify volunteer authorization (Defect 7)
    if current_user.role == UserRole.VOLUNTEER:
        vol_res = await db.execute(
            select(Volunteer).filter(Volunteer.user_id == current_user.id)
        )
        volunteer = vol_res.scalars().first()
        volunteer_id = volunteer.id if volunteer else None
        
        if task.volunteer_id not in [current_user.id, volunteer_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Error: Unauthorized volunteer access. This task is assigned to another rescuer."
            )

    # Secure Stage-wise Validation checks
    if event_type in [CustodyEventType.PICKUP, CustodyEventType.HANDOFF]:
        if task.status != "ASSIGNED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Error: Handoff scanned at wrong stage. Current status is {task.status}, expected ASSIGNED. reused QR rejected."
            )
    elif event_type == CustodyEventType.DELIVERY:
        if task.status != "PICKED_UP":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Error: Delivery scanned at wrong stage. Current status is {task.status}, expected PICKED_UP."
            )

    # Replay protection check for this specific event type
    existing_event = await db.execute(
        select(CustodyEvent).filter(
            CustodyEvent.qr_token == qr_token,
            CustodyEvent.event_type == event_type
        )
    )
    if existing_event.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Error: This custody stage {event_type.value} has already been verified. reused token rejected."
        )

    donation_res = await db.execute(
        select(Donation).filter(Donation.id == task.donation_id)
    )
    donation = donation_res.scalars().first()

    # Record the custody event
    event_id = str(uuid.uuid4())
    new_event = CustodyEvent(
        id=event_id,
        donation_id=task.donation_id,
        event_type=event_type,
        actor_id=current_user.id,
        qr_token=qr_token,
        timestamp=datetime.utcnow()
    )
    db.add(new_event)

    # Perform State transition
    if event_type in [CustodyEventType.PICKUP, CustodyEventType.HANDOFF]:
        task.status = "PICKED_UP"
        task.picked_up_at = datetime.utcnow()
        donation.status = DonationStatus.PICKED_UP
    elif event_type == CustodyEventType.DELIVERY:
        task.status = "DELIVERED"
        task.delivered_at = datetime.utcnow()
        donation.status = DonationStatus.COMPLETED
        history = list(donation.state_history or [])
        history.append({
            "status": "COMPLETED",
            "timestamp": datetime.utcnow().isoformat(),
            "actor": current_user.id
        })
        donation.state_history = history

    # Log action
    audit = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        action=f"CUSTODY_{event_type.name}",
        resource="pickup_tasks",
        after_value={"donation_id": task.donation_id, "qr_token": qr_token}
    )
    db.add(audit)

    await db.commit()
    return {"message": f"Custody {event_type.name} successfully verified", "donation_id": task.donation_id}
