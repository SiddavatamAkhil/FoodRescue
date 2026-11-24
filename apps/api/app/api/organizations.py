import os
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import RoleChecker, get_current_user, get_user_organization, verify_org_membership
from app.core.config import settings
from app.db.models import (
    AuditLog,
    Membership,
    Notification,
    Organization,
    OrganizationDocument,
    OrgRole,
    OrgType,
    User,
    UserRole,
    VerificationStatus,
)
from app.db.session import get_db
from app.schemas.onboarding import Branch
from app.schemas.organization import OrganizationCreate, OrganizationResponse, OrganizationVerify

router = APIRouter()

ROLE_FOR_TYPE = {
    OrgType.DONOR: UserRole.DONOR,
    OrgType.RECIPIENT: UserRole.RECIPIENT,
    OrgType.CORPORATE: UserRole.CORPORATE,
}

ALLOWED_DOC_TYPES = {"fssai_license", "ngo_registration", "pan", "gst_certificate", "identity_proof", "other"}
ALLOWED_MIME = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}
MAGIC = {".pdf": b"%PDF", ".jpg": b"\xff\xd8\xff", ".png": b"\x89PNG"}

STATUS_MESSAGES = {
    VerificationStatus.UNDER_REVIEW: "Your organization is now under review.",
    VerificationStatus.VERIFIED: "Your organization has been verified. You now have full access.",
    VerificationStatus.REJECTED: "Your verification request was rejected.",
    VerificationStatus.INFO_REQUIRED: "Additional information is required to complete verification.",
    VerificationStatus.SUSPENDED: "Your organization has been suspended.",
}


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != ROLE_FOR_TYPE.get(org_in.type):
        labels = {OrgType.DONOR: "Donor", OrgType.RECIPIENT: "Recipient", OrgType.CORPORATE: "Corporate"}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A non-{labels[org_in.type].lower()} user cannot create a {labels[org_in.type]} organization.",
        )

    org_id = str(uuid.uuid4())
    new_org = Organization(
        id=org_id,
        name=org_in.name,
        type=org_in.type,
        fssai_number=org_in.fssai_number,
        ngo_darpan_id=org_in.ngo_darpan_id,
        address=org_in.address,
        latitude=org_in.latitude,
        longitude=org_in.longitude,
        verification_status=VerificationStatus.PENDING,
        is_demo=False,
        profile={},
    )
    db.add(new_org)
    await db.flush()
    db.add(Membership(id=str(uuid.uuid4()), user_id=current_user.id, organization_id=org_id, role=OrgRole.ADMIN))
    await db.commit()
    await db.refresh(new_org)
    return new_org


@router.get("/mine", response_model=Optional[OrganizationResponse])
async def get_my_organization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_user_organization(db, current_user)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    result = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


class ProfileUpdate(BaseModel):
    operating_hours: Optional[str] = Field(default=None, max_length=120)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    food_categories: Optional[List[str]] = None
    branches: Optional[List[Branch]] = Field(default=None, max_length=50)
    daily_capacity: Optional[float] = Field(default=None, ge=0, le=100000)


@router.patch("/{org_id}/profile", response_model=OrganizationResponse)
async def update_profile(
    org_id: str,
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    result = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    profile = dict(org.profile or {})
    updates = body.model_dump(exclude_unset=True)
    if "daily_capacity" in updates:
        if org.type != OrgType.RECIPIENT:
            raise HTTPException(status_code=400, detail="Only recipient organizations have a daily capacity.")
        org.daily_capacity = updates.pop("daily_capacity")
    if "branches" in updates and updates["branches"] is not None:
        updates["branches"] = [b.model_dump() if hasattr(b, "model_dump") else b for b in updates["branches"]]
    profile.update(updates)
    org.profile = profile
    await db.commit()
    await db.refresh(org)
    return org


@router.post("/{org_id}/verify", response_model=OrganizationResponse)
async def verify_organization(
    org_id: str,
    verify_in: OrganizationVerify,
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if verify_in.status in (VerificationStatus.REJECTED, VerificationStatus.INFO_REQUIRED) and not (
        verify_in.notes and verify_in.notes.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a note explaining what the organization needs to do.",
        )

    before = org.verification_status
    org.verification_status = verify_in.status
    org.verification_notes = (verify_in.notes or "").strip() or None
    db.add(
        AuditLog(
            id=str(uuid.uuid4()),
            actor_id=current_user.id,
            action="VERIFY_ORGANIZATION",
            resource="organizations",
            before_value={"id": org.id, "status": before.value if before else None},
            after_value={"id": org.id, "status": verify_in.status.value, "notes": org.verification_notes},
        )
    )
    members = await db.execute(select(Membership).filter(Membership.organization_id == org.id))
    for m in members.scalars().all():
        msg = STATUS_MESSAGES.get(verify_in.status, "Your verification status changed.")
        if org.verification_notes:
            msg += f" Note from reviewer: {org.verification_notes}"
        db.add(
            Notification(
                id=str(uuid.uuid4()), user_id=m.user_id, type="VERIFICATION_STATUS",
                title="Verification update", message=msg,
            )
        )
    await db.commit()
    await db.refresh(org)
    return org


# ---------------------------------------------------------------------------
# Verification documents
# ---------------------------------------------------------------------------

def _safe_name(name: str) -> str:
    base = os.path.basename(name or "document")
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80]


@router.post("/{org_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    org_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    if document_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type.")
    ext = ALLOWED_MIME.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Upload a PDF, JPG or PNG file.")
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Files must be {settings.MAX_UPLOAD_MB} MB or smaller.")
    if not content.startswith(MAGIC[ext]):
        raise HTTPException(status_code=400, detail="The file content does not match its type.")

    doc_id = str(uuid.uuid4())
    folder = os.path.join(settings.UPLOAD_DIR, org_id)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{doc_id}{ext}")
    with open(path, "wb") as fh:
        fh.write(content)

    db.add(
        OrganizationDocument(
            id=doc_id,
            organization_id=org_id,
            file_path=path,
            document_type=document_type,
            status=VerificationStatus.PENDING,
        )
    )
    db.add(
        AuditLog(
            id=str(uuid.uuid4()), actor_id=current_user.id, action="UPLOAD_DOCUMENT",
            resource="organization_documents",
            after_value={"org_id": org_id, "document_id": doc_id, "type": document_type,
                         "filename": _safe_name(file.filename)},
        )
    )
    await db.commit()
    return {"message": "Document uploaded successfully", "id": doc_id, "document_type": document_type}


@router.get("/{org_id}/documents")
async def list_documents(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    res = await db.execute(
        select(OrganizationDocument)
        .filter(OrganizationDocument.organization_id == org_id)
        .order_by(OrganizationDocument.created_at.desc())
    )
    return [
        {"id": d.id, "document_type": d.document_type, "status": d.status.value, "created_at": d.created_at}
        for d in res.scalars().all()
    ]


@router.get("/{org_id}/documents/{doc_id}/file")
async def download_document(
    org_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    res = await db.execute(
        select(OrganizationDocument).filter(
            OrganizationDocument.id == doc_id, OrganizationDocument.organization_id == org_id
        )
    )
    doc = res.scalars().first()
    if not doc or not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(doc.file_path, filename=os.path.basename(doc.file_path))
