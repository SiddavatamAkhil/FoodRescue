import pytest
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from httpx import AsyncClient
from app.db.models import User, UserRole, Organization, Membership, OrgRole, OrgType, VerificationStatus, Donation, DonationStatus

@pytest.mark.asyncio
async def test_claims_and_qr_scenarios(client: AsyncClient, db_session: AsyncSession):
    # Setup users and organizations
    u_donor = User(id="donor_u", email="donor_u@foodrescue.org", hashed_password="...", full_name="Donor", role=UserRole.DONOR)
    u_ngo1 = User(id="ngo1_u", email="ngo1_u@foodrescue.org", hashed_password="...", full_name="NGO 1", role=UserRole.RECIPIENT)
    u_ngo2 = User(id="ngo2_u", email="ngo2_u@foodrescue.org", hashed_password="...", full_name="NGO 2", role=UserRole.RECIPIENT)
    u_ngo3 = User(id="ngo3_u", email="ngo3_u@foodrescue.org", hashed_password="...", full_name="NGO 3", role=UserRole.RECIPIENT)

    # Org 1: Verified
    org_donor = Organization(id="donor_o", name="Donor Org", type=OrgType.DONOR, address="AP", latitude=16.5, longitude=80.6, verification_status=VerificationStatus.VERIFIED)
    org_ngo_verified = Organization(id="ngo_v", name="Verified NGO", type=OrgType.RECIPIENT, address="AP", latitude=16.51, longitude=80.61, verification_status=VerificationStatus.VERIFIED)
    
    # Org 2: Unverified
    org_ngo_unverified = Organization(id="ngo_unv", name="Unverified NGO", type=OrgType.RECIPIENT, address="AP", latitude=16.51, longitude=80.61, verification_status=VerificationStatus.PENDING)
    
    # Org 3: Lacks capacity
    org_ngo_low_cap = Organization(id="ngo_low", name="Low Capacity NGO", type=OrgType.RECIPIENT, address="AP", latitude=16.51, longitude=80.61, verification_status=VerificationStatus.VERIFIED)

    db_session.add_all([u_donor, u_ngo1, u_ngo2, u_ngo3, org_donor, org_ngo_verified, org_ngo_unverified, org_ngo_low_cap])
    await db_session.commit()

    # Active Donation
    donation = Donation(
        id="donation_test",
        organization_id="donor_o",
        creator_id="donor_u",
        title="Excess Sambar and Rice",
        status=DonationStatus.PUBLISHED,
        latitude=16.5,
        longitude=80.6,
        pickup_address="AP",
        pickup_deadline=datetime.utcnow() + timedelta(hours=4)
    )
    db_session.add(donation)
    await db_session.commit()

    # Register/Login NGO 1
    reg_ngo = await client.post(
        "/api/v1/auth/register",
        json={"email": "ngo1@foodrescue.org", "password": "ngopassword", "full_name": "NGO Representative", "role": "RECIPIENT"}
    )
    login_ngo = await client.post(
        "/api/v1/auth/login",
        data={"username": "ngo1@foodrescue.org", "password": "ngopassword"}
    )
    token = login_ngo.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test 3: Unverified organization attempts to claim -> Rejected
    unv_res = await client.post(
        f"/api/v1/claims/donation/donation_test?org_id=ngo_unv",
        headers=headers
    )
    assert unv_res.status_code == 400
    assert "Unverified recipient organization" in unv_res.text

    # Test 4: Recipient lacks capacity -> Not eligible
    low_cap_res = await client.post(
        f"/api/v1/claims/donation/donation_test?org_id=ngo_low",
        headers=headers
    )
    assert low_cap_res.status_code == 400
    assert "does not have sufficient daily capacity" in low_cap_res.text

    # Test 2: Donation expires -> Cannot be claimed
    expired_donation = Donation(
        id="donation_exp",
        organization_id="donor_o",
        creator_id="donor_u",
        title="Expired Veg Biryani",
        status=DonationStatus.PUBLISHED,
        latitude=16.5,
        longitude=80.6,
        pickup_address="AP",
        pickup_deadline=datetime.utcnow() - timedelta(hours=1) # Expired
    )
    db_session.add(expired_donation)
    await db_session.commit()

    exp_claim_res = await client.post(
        f"/api/v1/claims/donation/donation_exp?org_id=ngo_v",
        headers=headers
    )
    assert exp_claim_res.status_code == 400
    assert "Expired donation cannot be claimed" in exp_claim_res.text

    # Test 1: Concurrency (Two recipients claim simultaneously)
    # We will invoke claims concurrently for ngo_v.
    # Exactly one should succeed, the other should fail because status transitions from PUBLISHED to CLAIMED.
    async def try_claim(org_id: str):
        return await client.post(
            f"/api/v1/claims/donation/donation_test?org_id={org_id}",
            headers=headers
        )

    tasks = [try_claim("ngo_v"), try_claim("ngo_v")]
    responses = await asyncio.gather(*tasks)
    
    status_codes = [r.status_code for r in responses]
    assert 201 in status_codes
    assert 400 in status_codes # One succeeds, the other fails with "expected PUBLISHED"

    # Test 9: QR token single-use check
    # Let's assign volunteer to our claimed donation
    u_volunteer = User(id="volunteer_u", email="volunteer@foodrescue.org", hashed_password="...", full_name="Volunteer User", role=UserRole.VOLUNTEER)
    db_session.add(u_volunteer)
    await db_session.commit()

    assign_res = await client.post(
        f"/api/v1/pickups/assign/donation_test?volunteer_id=volunteer_u",
        headers=headers
    )
    assert assign_res.status_code == 201
    qr_token = assign_res.json()["qr_token"]

    # First pickup verify handoff (should succeed)
    verify_res1 = await client.post(
        f"/api/v1/pickups/verify-handoff?qr_token={qr_token}&event_type=HANDOFF",
        headers=headers
    )
    assert verify_res1.status_code == 200

    # Second handoff using the same token (reused QR) -> MUST be rejected (Test 9)
    verify_res2 = await client.post(
        f"/api/v1/pickups/verify-handoff?qr_token={qr_token}&event_type=HANDOFF",
        headers=headers
    )
    assert verify_res2.status_code == 400
    assert "reused" in verify_res2.text or "replay rejected" in verify_res2.text or "validated" in verify_res2.text
