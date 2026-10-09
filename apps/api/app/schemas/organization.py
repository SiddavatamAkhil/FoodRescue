from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.db.models import OrgType, VerificationStatus

class OrganizationCreate(BaseModel):
    name: str
    type: OrgType
    fssai_number: Optional[str] = None
    ngo_darpan_id: Optional[str] = None
    address: str
    latitude: float
    longitude: float

class OrganizationResponse(BaseModel):
    id: str
    name: str
    type: OrgType
    verification_status: VerificationStatus
    fssai_number: Optional[str] = None
    ngo_darpan_id: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OrganizationVerify(BaseModel):
    status: VerificationStatus
    notes: Optional[str] = None
