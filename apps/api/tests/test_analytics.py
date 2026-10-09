import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from app.db.models import User, UserRole, Organization, OrgType, VerificationStatus, Donation, DonationStatus

@pytest.mark.asyncio
async def test_analytics_excludes_demo_records(client: AsyncClient, db_session: AsyncSession):
    # Seed admin directly in database
    from app.core.security import hash_password
    admin_user = User(
        id="super_admin_test_id",
        email="super_admin@foodrescue.org",
        hashed_password=hash_password("superpassword"),
        full_name="Admin",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()
    login_admin = await client.post(
        "/api/v1/auth/login",
        data={"username": "super_admin@foodrescue.org", "password": "superpassword"}
    )
    headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    # 1. Trigger Seed (creates is_demo = true records)
    seed_res = await client.post("/api/v1/admin/seed-demo", headers=headers)
    assert seed_res.status_code == 201

    # 2. Query Analytics -> Should show 0 real records because only demo data exists
    analytics_res1 = await client.get("/api/v1/analytics/metrics")
    assert analytics_res1.status_code == 200
    metrics1 = analytics_res1.json()["production_metrics"]
    assert metrics1["active_donations_unclaimed"] == 0
    assert metrics1["total_registered_organizations"] == 0

    # 3. Insert 1 Real (non-demo) Organization and 1 Real Donation
    real_org = Organization(
        id="real_org_1",
        name="Real Guntur Kitchens",
        type=OrgType.DONOR,
        address="Guntur, AP",
        latitude=16.3067,
        longitude=80.4365,
        verification_status=VerificationStatus.VERIFIED,
        is_demo=False
    )
    real_donation = Donation(
        id="real_donation_1",
        organization_id="real_org_1",
        creator_id="demo_donor_u", # seeded user is fine or dummy
        title="Real Sambar Feed",
        status=DonationStatus.PUBLISHED,
        latitude=16.3067,
        longitude=80.4365,
        pickup_address="Guntur Center",
        pickup_deadline=datetime.utcnow() + timedelta(hours=5),
        is_demo=False
    )
    
    db_session.add_all([real_org, real_donation])
    await db_session.commit()

    # 4. Query Analytics again -> Should count ONLY the real records
    analytics_res2 = await client.get("/api/v1/analytics/metrics")
    metrics2 = analytics_res2.json()["production_metrics"]
    assert metrics2["active_donations_unclaimed"] == 1
    assert metrics2["total_registered_organizations"] == 1
