from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class DemandCreate(BaseModel):
    food_category: str = Field(min_length=2, max_length=40) # e.g. cooked_veg, dry_rations
    quantity_needed: float = Field(gt=0, le=100000)
    unit: str = Field(min_length=1, max_length=20)
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
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
