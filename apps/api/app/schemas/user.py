import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.db.models import UserRole

PHONE_RE = re.compile(r"^\+?[0-9]{10,13}$")


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: UserRole


class UserCreate(UserBase):
    password: str
    phone: Optional[str] = None
    organization_name: Optional[str] = Field(default=None, max_length=160)
    accept_terms: bool = False

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        cleaned = re.sub(r"[\s-]", "", v)
        if not PHONE_RE.match(cleaned):
            raise ValueError("Enter a valid phone number, for example +91 98765 43210.")
        return cleaned


class UserResponse(UserBase):
    # Stored addresses are not re-validated on output (validation happens on input).
    email: str
    id: str
    is_active: bool
    created_at: datetime
    phone: Optional[str] = None
    email_verified: bool = False
    phone_verified: bool = False
    onboarding_completed: bool = False

    class Config:
        from_attributes = True


class OrganizationSummary(BaseModel):
    id: str
    name: str
    type: str
    verification_status: str
    verification_notes: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    daily_capacity: Optional[float] = None
    fssai_number: Optional[str] = None
    ngo_darpan_id: Optional[str] = None
    profile: dict = {}


class VolunteerSummary(BaseModel):
    id: str
    vehicle_type: Optional[str] = None
    vehicle_capacity: Optional[float] = None
    service_area: Optional[str] = None
    availability: dict = {}
    is_available: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class MeResponse(UserResponse):
    profile: dict = {}
    organization: Optional[OrganizationSummary] = None
    volunteer: Optional[VolunteerSummary] = None
    phone_verification_available: bool = False


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return UserCreate.check_phone(v)


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: Optional[int] = None
    role: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class TokenData(BaseModel):
    user_id: Optional[str] = None


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class PasswordReset(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str
