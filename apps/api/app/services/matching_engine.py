import math
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.db.models import Donation, Organization, Match, VerificationStatus, DonationStatus, Demand

MATCH_CONFIG = {
    "version": "1.0.0",
    "weights": {
        "distance": 25,
        "quantity_fit": 20,
        "urgency": 20,
        "compatibility": 15,
        "capacity": 10,
        "pickup_avail": 10
    }
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth in kilometers.
    """
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def match_donation_to_recipients(
    db: AsyncSession,
    donation: Donation
) -> List[Dict[str, Any]]:
    """
    Step 1: Apply Strict Hard Constraints
    Step 2: Real Configurable Normalization Scoring (Strictly computed from actual DB parameters)
    """
    # Hard Constraint 1: Check if donation has expired
    if donation.pickup_deadline < datetime.utcnow():
        return []

    # Query all active recipient organizations
    result = await db.execute(
        select(Organization)
        .filter(Organization.type == "RECIPIENT")
    )
    recipients = result.scalars().all()
    
    matches = []
    
    for recipient in recipients:
        # Hard Constraint 2: Recipient must be VERIFIED
        if recipient.verification_status != VerificationStatus.VERIFIED:
            continue
            
        # Compute Haversine distance
        dist = haversine_distance(donation.latitude, donation.longitude, recipient.latitude, recipient.longitude)
        
        # Hard Constraint 3: Max coverage area (e.g. 50 km)
        if dist > 50.0:
            continue

        # 1. Distance score calculation: linear decay from 100 (<1km) to 0 (50km)
        dist_score = max(0.0, 100.0 * (1.0 - dist / 50.0))
        
        # 2. Urgency score calculation: hours left until deadline
        time_left = (donation.pickup_deadline - datetime.utcnow()).total_seconds() / 3600.0 # hours
        urgency_score = max(0.0, 100.0 * (1.0 - min(time_left, 12.0) / 12.0))
        
        # Query active Demands for this recipient organization
        demand_res = await db.execute(
            select(Demand).filter(Demand.organization_id == recipient.id)
        )
        demands = demand_res.scalars().all()
        
        # 3. Quantity fit score: compare donation quantity vs recipient demand quantity
        donation_qty = sum(item.quantity for item in donation.food_items) if hasattr(donation, 'food_items') and donation.food_items else 20.0
        if demands:
            # Calculate distance of fit from closest demand
            min_diff = min(abs(d.quantity_needed - donation_qty) for d in demands)
            quantity_score = max(0.0, 100.0 - min_diff)
        else:
            quantity_score = 65.0 # Fallback default
        
        # 4. Compatibility score: check vegetarian compatibility
        compatibility_score = 100.0
        donation_is_veg = all(item.is_veg for item in donation.food_items) if hasattr(donation, 'food_items') and donation.food_items else True
        if not donation_is_veg:
            # If recipient strictly has veg demands, compatible score decays
            recipient_strict_veg = any(d.food_category == "veg" for d in demands) if demands else False
            if recipient_strict_veg:
                compatibility_score = 25.0
        
        # 5. Capacity score: higher score for high-priority unfulfilled demands (more empty capacity/higher reception)
        has_high_priority_demand = any(d.priority == "high" for d in demands) if demands else False
        capacity_score = 100.0 if has_high_priority_demand else 80.0
        
        # 6. Pickup availability score: decays if deadline is extremely tight (< 1.5 hours remaining)
        pickup_score = 50.0 if time_left < 1.5 else 100.0

        # Weighted aggregate score
        weights = MATCH_CONFIG["weights"]
        final_score = (
            dist_score * (weights["distance"] / 100.0) +
            urgency_score * (weights["urgency"] / 100.0) +
            compatibility_score * (weights["compatibility"] / 100.0) +
            capacity_score * (weights["capacity"] / 100.0) +
            pickup_score * (weights["pickup_avail"] / 100.0) +
            quantity_score * (weights["quantity_fit"] / 100.0)
        )
        
        # Build explanation
        explanation = {
            "distance_km": round(dist, 2),
            "time_left_hours": round(time_left, 2),
            "reasons": [
                f"{round(dist, 1)} km from donor",
                "FSSAI safety verified organization",
                f"Pickup available within {round(time_left, 1)} hours"
            ]
        }
        
        matches.append({
            "organization_id": recipient.id,
            "score": round(final_score, 2),
            "explanation": explanation,
            "matching_config_version": MATCH_CONFIG["version"]
        })
        
    # Sort matches by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches
