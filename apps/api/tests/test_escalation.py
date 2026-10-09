import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import Donation, DonationStatus, Notification, AuditLog
from app.services.escalation_engine import run_escalation_checks

@pytest.mark.asyncio
async def test_escalation_and_auto_expiry(db_session: AsyncSession):
    now = datetime.utcnow()
    
    # 1. Create a donation that is already expired
    expired_donation = Donation(
        id="donation_expired_test",
        organization_id="org_dummy",
        creator_id="user_dummy",
        title="Yesterday's Curd Rice",
        status=DonationStatus.PUBLISHED,
        latitude=16.5,
        longitude=80.6,
        pickup_address="Nellore",
        pickup_deadline=now - timedelta(minutes=15) # Expired 15 mins ago
    )
    
    # 2. Create a donation that is at risk (expires in 1 hour)
    at_risk_donation = Donation(
        id="donation_at_risk_test",
        organization_id="org_dummy",
        creator_id="user_dummy",
        title="Hot Fresh Samosas",
        status=DonationStatus.PUBLISHED,
        latitude=16.5,
        longitude=80.6,
        pickup_address="Guntur",
        pickup_deadline=now + timedelta(hours=1) # Expiring in 1 hour
    )
    
    db_session.add_all([expired_donation, at_risk_donation])
    await db_session.commit()
    
    # Run the escalation checks
    expired_cnt, at_risk_cnt = await run_escalation_checks(db_session)
    
    assert expired_cnt == 1
    assert at_risk_cnt == 1
    
    # Check that expired_donation was transitioned to EXPIRED (Test 10)
    res_exp = await db_session.execute(select(Donation).filter(Donation.id == "donation_expired_test"))
    donation_exp = res_exp.scalars().first()
    assert donation_exp.status == DonationStatus.EXPIRED
    
    # Check that appropriate notifications were written to DB (Test 10)
    res_notif = await db_session.execute(select(Notification))
    notifs = res_notif.scalars().all()
    assert len(notifs) == 2
    types = [n.type for n in notifs]
    assert "DONATION_EXPIRED" in types
    assert "DONATION_AT_RISK" in types
