import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import User, Demand, Organization, VerificationStatus
from app.schemas.demand import DemandCreate, DemandResponse
from app.api.deps import get_current_user, verify_org_membership

router = APIRouter()

@router.post("/", response_model=DemandResponse, status_code=status.HTTP_201_CREATED)
async def create_demand(
    demand_in: DemandCreate,
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = Depends(verify_org_membership)
):
    org_res = await db.execute(select(Organization).filter(Organization.id == org_id))
    org = org_res.scalars().first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        
    if org.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization must be VERIFIED before creating demand requests."
        )

    demand_id = str(uuid.uuid4())
    new_demand = Demand(
        id=demand_id,
        organization_id=org_id,
        food_category=demand_in.food_category,
        quantity_needed=demand_in.quantity_needed,
        unit=demand_in.unit,
        priority=demand_in.priority,
        latitude=demand_in.latitude,
        longitude=demand_in.longitude
    )
    db.add(new_demand)
    await db.commit()
    await db.refresh(new_demand)
    return new_demand
