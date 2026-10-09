import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import Donation, DonationStatus, Notification, AuditLog

async def run_escalation_checks(db: AsyncSession):
    """
    Checks all published donations.
    - If deadline has passed: transitions status to EXPIRED and alerts the donor.
    - If deadline is within 2 hours: triggers AT_RISK alerts to nearby recipients.
    """
    now = datetime.utcnow()
    
    # 1. Fetch expired donations
    expired_result = await db.execute(
        select(Donation).filter(
            Donation.status == DonationStatus.PUBLISHED,
            Donation.pickup_deadline <= now
        )
    )
    expired_donations = expired_result.scalars().all()
    
    for donation in expired_donations:
        donation.status = DonationStatus.EXPIRED
        history = list(donation.state_history or [])
        history.append({
            "status": "EXPIRED",
            "timestamp": now.isoformat(),
            "actor": "system_escalation_engine"
        })
        donation.state_history = history
        
        # Create expired notification for donor
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=donation.creator_id,
            type="DONATION_EXPIRED",
            title="Donation Expired",
            message=f"Your donation '{donation.title}' has expired without being claimed.",
            is_read=False
        )
        db.add(notif)
        
        # Create audit log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            action="AUTO_EXPIRE",
            resource="donations",
            before_value={"status": "PUBLISHED"},
            after_value={"status": "EXPIRED", "id": donation.id}
        )
        db.add(audit)
        
    # 2. Fetch at-risk donations (unclaimed and < 2 hours remaining)
    at_risk_threshold = now + timedelta(hours=2)
    at_risk_result = await db.execute(
        select(Donation).filter(
            Donation.status == DonationStatus.PUBLISHED,
            Donation.pickup_deadline > now,
            Donation.pickup_deadline <= at_risk_threshold
        )
    )
    at_risk_donations = at_risk_result.scalars().all()
    
    for donation in at_risk_donations:
        # Create escalation/risk alerts for Donor & System Ops
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=donation.creator_id,
            type="DONATION_AT_RISK",
            title="Donation At Risk",
            message=f"Alert: Your donation '{donation.title}' is expiring in less than 2 hours and hasn't been claimed yet.",
            is_read=False
        )
        db.add(notif)
        
    await db.commit()
    return len(expired_donations), len(at_risk_donations)
