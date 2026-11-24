from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
from typing import Optional, List
from app.db.models import DonationStatus

def to_naive_utc(v: datetime) -> datetime:
    """The database stores naive UTC timestamps; convert any offset-aware input."""
    if v.tzinfo is not None:
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
    return v


class FoodItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    quantity: float = Field(gt=0, le=100000)
    unit: str # "kg", "meals", "boxes"
    is_veg: bool
    prep_time: datetime
    expiry_time: datetime
    is_leftover: bool # Plate leftovers vs unserved

    @field_validator('prep_time', 'expiry_time')
    @classmethod
    def naive_utc(cls, v: datetime) -> datetime:
        return to_naive_utc(v)

    @field_validator('is_leftover')
    @classmethod
    def check_food_safety_leftovers(cls, v: bool) -> bool:
        # Business/safety rule: Plate leftovers are strictly unsafe and not allowed
        if v:
            raise ValueError(
                "Under Food Safety Policy (PLATFORM POLICY / FSSAI GUIDANCE): "
                "Plate leftovers or consumer-exposed food are ineligible for redistribution due to high contamination risk. "
                "Only unserved surplus food can be published."
            )
        return v

class FoodItemResponse(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str
    is_veg: bool
    prep_time: datetime
    expiry_time: datetime
    is_leftover: bool

    class Config:
        from_attributes = True

class DonationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    pickup_address: str
    pickup_deadline: datetime
    storage_info: Optional[str] = None
    latitude: float
    longitude: float
    food_items: List[FoodItemCreate]

    @field_validator('pickup_deadline')
    @classmethod
    def deadline_in_future(cls, v: datetime) -> datetime:
        v = to_naive_utc(v)
        if v <= datetime.utcnow():
            raise ValueError("Pickup deadline must be in the future.")
        return v

    @field_validator('food_items')
    @classmethod
    def at_least_one_item(cls, v):
        if not v:
            raise ValueError("Add at least one food item.")
        return v

class DonationResponse(BaseModel):
    id: str
    organization_id: str
    creator_id: str
    title: str
    description: Optional[str] = None
    status: DonationStatus
    latitude: float
    longitude: float
    pickup_address: str
    pickup_deadline: datetime
    storage_info: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    food_items: List[FoodItemResponse]
    claimed_by_org_id: Optional[str] = None
    state_history: List[dict] = []

    @field_validator('state_history', mode='before')
    @classmethod
    def public_history(cls, v):
        # Expose only status and time; actor identifiers stay in the audit log.
        return [{"status": h.get("status"), "timestamp": h.get("timestamp")} for h in (v or []) if isinstance(h, dict)]

    class Config:
        from_attributes = True

class DonationTransition(BaseModel):
    status: DonationStatus
