"""Role-specific onboarding payloads."""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

FOOD_CATEGORIES = {
    "cooked_veg", "cooked_non_veg", "bakery", "dry_rations", "fruits_vegetables", "dairy", "packaged",
}


class Location(BaseModel):
    address: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=6.0, le=38.0)   # India bounding box
    longitude: float = Field(ge=68.0, le=98.0)


class Branch(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    contact_phone: Optional[str] = Field(default=None, max_length=20)


def _check_categories(v: List[str]) -> List[str]:
    bad = [c for c in v if c not in FOOD_CATEGORIES]
    if bad:
        raise ValueError(f"Unknown food categories: {', '.join(bad)}")
    if not v:
        raise ValueError("Select at least one food category.")
    return v


class DonorOnboarding(BaseModel):
    business_name: str = Field(min_length=2, max_length=160)
    business_category: str = Field(min_length=2, max_length=60)  # restaurant, hotel, caterer...
    location: Location
    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str = Field(min_length=10, max_length=20)
    fssai_number: Optional[str] = Field(default=None, pattern=r"^\d{14}$")
    operating_hours: str = Field(min_length=3, max_length=120)
    food_categories: List[str]

    @field_validator("food_categories")
    @classmethod
    def check_categories(cls, v: List[str]) -> List[str]:
        return _check_categories(v)


class NgoOnboarding(BaseModel):
    organization_name: str = Field(min_length=2, max_length=160)
    registration_number: str = Field(min_length=3, max_length=60)  # NGO Darpan ID / trust / society reg.
    fssai_number: Optional[str] = Field(default=None, pattern=r"^\d{14}$")
    location: Location
    operating_locations: List[str] = Field(default_factory=list, max_length=20)
    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str = Field(min_length=10, max_length=20)
    daily_meal_capacity: int = Field(ge=1, le=100000)
    food_categories: List[str]

    @field_validator("food_categories")
    @classmethod
    def check_categories(cls, v: List[str]) -> List[str]:
        return _check_categories(v)


class VolunteerOnboarding(BaseModel):
    contact_phone: str = Field(min_length=10, max_length=20)
    service_area: str = Field(min_length=2, max_length=120)
    latitude: Optional[float] = Field(default=None, ge=6.0, le=38.0)
    longitude: Optional[float] = Field(default=None, ge=68.0, le=98.0)
    available_days: List[str] = Field(min_length=1)
    available_from: str = Field(pattern=r"^\d{2}:\d{2}$")
    available_to: str = Field(pattern=r"^\d{2}:\d{2}$")
    vehicle_type: Optional[str] = Field(default=None, pattern=r"^(none|bicycle|two_wheeler|auto|car|van)$")
    vehicle_capacity_kg: Optional[float] = Field(default=None, ge=0, le=5000)

    @field_validator("available_days")
    @classmethod
    def check_days(cls, v: List[str]) -> List[str]:
        valid = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
        if any(d not in valid for d in v):
            raise ValueError("Invalid day in availability.")
        return v


class CorporateOnboarding(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    industry: str = Field(min_length=2, max_length=80)
    cin_or_gstin: Optional[str] = Field(default=None, max_length=30)
    location: Location
    representative_name: str = Field(min_length=2, max_length=120)
    representative_designation: str = Field(min_length=2, max_length=80)
    contact_email: str = Field(min_length=5, max_length=160)
    contact_phone: str = Field(min_length=10, max_length=20)
    branches: List[Branch] = Field(default_factory=list, max_length=50)
