import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import RoleChecker, get_current_user, is_staff
from app.core.rate_limit import SlidingWindowLimiter, client_ip
from app.db.models import AuditLog, ContactMessage, Donation, Incident, User, UserRole
from app.db.session import get_db

router = APIRouter()
contact_router = APIRouter()
contact_limiter = SlidingWindowLimiter(5, 3600)


class IncidentCreate(BaseModel):
    donation_id: Optional[str] = None
    category: str = Field(pattern="^(food_safety|no_show|quantity_mismatch|packaging|other)$")
    description: str = Field(min_length=10, max_length=2000)


class IncidentUpdate(BaseModel):
    status: str = Field(pattern="^(OPEN|INVESTIGATING|RESOLVED)$")
    resolution_notes: Optional[str] = Field(default=None, max_length=2000)


def _out(i: Incident, reporter: Optional[str] = None) -> dict:
    return {
        "id": i.id, "donation_id": i.donation_id, "category": i.category, "description": i.description,
        "status": i.status, "resolution_notes": i.resolution_notes, "created_at": i.created_at,
        "updated_at": i.updated_at, "reporter_email": reporter,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def report_incident(
    body: IncidentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.donation_id:
        d = (await db.execute(select(Donation).filter(Donation.id == body.donation_id))).scalars().first()
        if not d:
            raise HTTPException(status_code=404, detail="Donation not found")
    inc = Incident(
        id=str(uuid.uuid4()), reporter_id=current_user.id, donation_id=body.donation_id,
        category=body.category, description=body.description.strip(), status="OPEN",
    )
    db.add(inc)
    db.add(AuditLog(id=str(uuid.uuid4()), actor_id=current_user.id, action="REPORT_INCIDENT",
                    resource="incidents", after_value={"id": inc.id, "category": body.category}))
    await db.commit()
    return _out(inc)


@router.get("/")
async def list_incidents(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Incident, User.email).join(User, User.id == Incident.reporter_id)
    if not is_staff(current_user):
        q = q.filter(Incident.reporter_id == current_user.id)
    if status_filter:
        q = q.filter(Incident.status == status_filter)
    res = await db.execute(q.order_by(Incident.created_at.desc()).limit(200))
    return [_out(i, email) for i, email in res.all()]


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: str,
    body: IncidentUpdate,
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    inc = (await db.execute(select(Incident).filter(Incident.id == incident_id))).scalars().first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    before = inc.status
    inc.status = body.status
    if body.resolution_notes is not None:
        inc.resolution_notes = body.resolution_notes.strip() or None
    db.add(AuditLog(id=str(uuid.uuid4()), actor_id=current_user.id, action="UPDATE_INCIDENT",
                    resource="incidents", before_value={"status": before}, after_value={"status": body.status}))
    await db.commit()
    return _out(inc)


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    organization: Optional[str] = Field(default=None, max_length=160)
    topic: str = Field(pattern="^(donor|ngo|volunteer|corporate|partnership|support|other)$")
    message: str = Field(min_length=10, max_length=4000)


@contact_router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_contact(body: ContactCreate, request: Request, db: AsyncSession = Depends(get_db)):
    contact_limiter.check_and_hit(f"contact:{client_ip(request)}", "Too many messages sent. Try again later.")
    db.add(ContactMessage(
        id=str(uuid.uuid4()), name=body.name.strip(), email=body.email.lower(),
        organization=(body.organization or "").strip() or None, topic=body.topic, message=body.message.strip(),
    ))
    await db.commit()
    return {"message": "Message received. We will reply by email."}
