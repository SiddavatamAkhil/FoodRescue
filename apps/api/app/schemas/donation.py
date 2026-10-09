from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List
from app.db.models import DonationStatus

class FoodItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str # "kg", "meals", "boxes"
    is_veg: bool
    prep_time: datetime
    expiry_time: datetime
    is_leftover: bool # Plate leftovers vs unserved

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

    class Config:
        from_attributes = True

class DonationTransition(BaseModel):
    status: DonationStatus
