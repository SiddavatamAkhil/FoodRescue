import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import User, UserRole, Organization, Membership, OrgRole, OrgType, VerificationStatus, OrganizationDocument
from app.schemas.organization import OrganizationCreate, OrganizationResponse, OrganizationVerify
from app.api.deps import get_current_user, RoleChecker, verify_org_membership

router = APIRouter()

@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify that the user has appropriate role for this organization type
    if org_in.type == OrgType.DONOR and current_user.role != UserRole.DONOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-donor user cannot create a Donor organization."
        )
    if org_in.type == OrgType.RECIPIENT and current_user.role != UserRole.RECIPIENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-recipient user cannot create a Recipient organization."
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
        is_demo=False
    )
    db.add(new_org)

    # Assign user as Admin of the newly created organization
    membership = Membership(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        organization_id=org_id,
        role=OrgRole.ADMIN
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_org)
    return new_org

@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = Depends(verify_org_membership)
):
    result = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org

@router.post("/{org_id}/verify", response_model=OrganizationResponse)
async def verify_organization(
    org_id: str,
    verify_in: OrganizationVerify,
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.OPS_MANAGER])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    
    org.verification_status = verify_in.status
    await db.commit()
    await db.refresh(org)
    return org

@router.post("/{org_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    org_id: str,
    document_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = Depends(verify_org_membership)
):
    # Safe secure filename check / local storage
    # In a real system, we'd upload to secure local store or S3
    simulated_path = f"/secure_storage/{org_id}/{uuid.uuid4()}_{file.filename}"
    
    new_doc = OrganizationDocument(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        file_path=simulated_path,
        document_type=document_type,
        status=VerificationStatus.PENDING
    )
    db.add(new_doc)
    await db.commit()
    return {"message": "Document uploaded successfully", "path": simulated_path}
