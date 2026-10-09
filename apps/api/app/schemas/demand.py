from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DemandCreate(BaseModel):
    food_category: str # "veg", "non-veg", "dry", "cooked"
    quantity_needed: float
    unit: str
    priority: str = "medium" # "low", "medium", "high"
    latitude: float
    longitude: float

class DemandResponse(BaseModel):
    id: str
    organization_id: str
    food_category: str
    quantity_needed: float
    unit: str
    priority: str
    latitude: float
    longitude: float
    created_at: datetime

    class Config:
        from_attributes = True
