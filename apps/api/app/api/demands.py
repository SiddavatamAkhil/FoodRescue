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


from typing import List as _List


@router.get("/", response_model=_List[DemandResponse])
async def list_demands(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_org_membership),
):
    res = await db.execute(select(Demand).filter(Demand.organization_id == org_id).order_by(Demand.created_at.desc()))
    return res.scalars().all()


@router.delete("/{demand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_demand(
    demand_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.api.deps import is_org_member

    res = await db.execute(select(Demand).filter(Demand.id == demand_id))
    demand = res.scalars().first()
    if not demand:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if not await is_org_member(db, current_user, demand.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")
    await db.delete(demand)
    await db.commit()
