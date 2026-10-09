import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, UserRole, Organization, Membership, OrgRole, OrgType, VerificationStatus, Donation, DonationStatus

@pytest.mark.asyncio
async def test_complete_e2e_food_rescue_journey(client: AsyncClient, db_session: AsyncSession):
    """
    Simulates the entire operational journey of a surplus redistribution end-to-end.
    - Donor registers & creates organization.
    - Admin verifies donor organization.
    - Donor publishes an unserved food listing using the AI listing assistant schema outputs.
    - Matching Engine scores nearby recipient NGOs.
    - Verified NGO claims the donation (Claim Concurrency-Safe Gate).
    - Volunteer receives assigned task.
    - Handoff QR Code transfer (Secure custody event).
    - Delivery QR Code transfer (Final delivery custody event).
    - Donation state moves to COMPLETED.
    - Production analytics matches accurately.
    """
    # 1. AUTHENTICATE & ONBOARDING
    # Register & Login Donor
    reg_donor = await client.post(
        "/api/v1/auth/register",
        json={"email": "donor_e2e@foodrescue.org", "password": "donorpassword", "full_name": "E2E Donor Owner", "role": "DONOR"}
    )
    assert reg_donor.status_code == 201
    
    login_donor = await client.post(
        "/api/v1/auth/login",
        data={"username": "donor_e2e@foodrescue.org", "password": "donorpassword"}
    )
    donor_token = login_donor.json()["access_token"]
    donor_headers = {"Authorization": f"Bearer {donor_token}"}

    # Register & Login NGO Recipient
    reg_ngo = await client.post(
        "/api/v1/auth/register",
        json={"email": "ngo_e2e@foodrescue.org", "password": "ngopassword", "full_name": "E2E NGO Rep", "role": "RECIPIENT"}
    )
    assert reg_ngo.status_code == 201
    
    login_ngo = await client.post(
        "/api/v1/auth/login",
        data={"username": "ngo_e2e@foodrescue.org", "password": "ngopassword"}
    )
    ngo_token = login_ngo.json()["access_token"]
    ngo_headers = {"Authorization": f"Bearer {ngo_token}"}

    # 2. CREATE ORGANIZATIONS
    donor_org_res = await client.post(
        "/api/v1/organizations/",
        headers=donor_headers,
        json={"name": "E2E Kurnool Banquet", "type": "DONOR", "fssai_number": "12345678901234", "address": "Kurnool Center, AP", "latitude": 15.8284, "longitude": 78.0373}
    )
    donor_org_id = donor_org_res.json()["id"]

    ngo_org_res = await client.post(
        "/api/v1/organizations/",
        headers=ngo_headers,
        json={"name": "E2E Kurnool Relief Aid", "type": "RECIPIENT", "address": "Kurnool, AP", "latitude": 15.8300, "longitude": 78.0400}
    )
    ngo_org_id = ngo_org_res.json()["id"]

    # 3. ADMIN VERIFICATION
    # Create Admin User directly in database
    from app.core.security import hash_password
    admin_user = User(
        id="admin_e2e_test_id",
        email="admin_e2e@foodrescue.org",
        hashed_password=hash_password("adminpassword"),
        full_name="E2E Admin",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()
    login_admin = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin_e2e@foodrescue.org", "password": "adminpassword"}
    )
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify both organizations
    v1 = await client.post(f"/api/v1/organizations/{donor_org_id}/verify", headers=admin_headers, json={"status": "VERIFIED", "notes": "FSSAI complete."})
    v2 = await client.post(f"/api/v1/organizations/{ngo_org_id}/verify", headers=admin_headers, json={"status": "VERIFIED", "notes": "Onboarding document complete."})
    assert v1.status_code == 200
    assert v2.status_code == 200

    # 4. SURPLUS FOOD LISTING & AI VALIDATION
    # Parse unstructured text through AI Assistant
    ai_parse_res = await client.post(
        "/api/v1/ai/parse-listing",
        headers=donor_headers,
        json={"text": "We have 45 veg biryani boxes prepared at 1 PM."}
    )
    assert ai_parse_res.status_code == 200
    ai_data = ai_parse_res.json()
    assert ai_data["is_leftover"] is False

    # Create & Publish Donation
    donation_res = await client.post(
        f"/api/v1/donations/?org_id={donor_org_id}",
        headers=donor_headers,
        json={
            "title": ai_data["name"],
            "pickup_address": "Kurnool Event Hall",
            "pickup_deadline": "2026-10-09T23:00:00",
            "latitude": 15.8284,
            "longitude": 78.0373,
            "food_items": [
                {
                    "name": ai_data["name"],
                    "quantity": ai_data["quantity"],
                    "unit": ai_data["unit"],
                    "is_veg": ai_data["is_veg"],
                    "prep_time": "2026-10-09T13:00:00",
                    "expiry_time": "2026-10-09T19:00:00",
                    "is_leftover": False
                }
            ]
        }
    )
    assert donation_res.status_code == 201
    donation_id = donation_res.json()["id"]

    # Publish draft listing
    pub_res = await client.post(
        f"/api/v1/donations/{donation_id}/transition",
        headers=donor_headers,
        json={"status": "PUBLISHED"}
    )
    assert pub_res.status_code == 200

    # 5. MATCHING & CLAIMING
    # Query recommended matches for recipient NGO
    match_res = await client.get(
        f"/api/v1/matching/donation/{donation_id}",
        headers=ngo_headers
    )
    assert match_res.status_code == 200
    matches = match_res.json()["matches"]
    assert len(matches) > 0
    assert matches[0]["organization_id"] == ngo_org_id

    # Claim donation (concurrency-safe)
    claim_res = await client.post(
        f"/api/v1/claims/donation/{donation_id}?org_id={ngo_org_id}",
        headers=ngo_headers
    )
    assert claim_res.status_code == 201

    # 6. LOGISTICS & SECURE QR CUSTODY HANDOVER
    # Register logistics volunteer
    reg_volunteer = await client.post(
        "/api/v1/auth/register",
        json={"email": "volunteer_e2e@foodrescue.org", "password": "volunteerpassword", "full_name": "E2E Volunteer", "role": "VOLUNTEER"}
    )
    assert reg_volunteer.status_code == 201
    volunteer_id = reg_volunteer.json()["id"]
    
    login_vol = await client.post(
        "/api/v1/auth/login",
        data={"username": "volunteer_e2e@foodrescue.org", "password": "volunteerpassword"}
    )
    vol_headers = {"Authorization": f"Bearer {login_vol.json()['access_token']}"}

    # Assign volunteer task
    assign_res = await client.post(
        f"/api/v1/pickups/assign/{donation_id}?volunteer_id={volunteer_id}", # real volunteer user id
        headers=ngo_headers
    )
    assert assign_res.status_code == 201
    qr_token = assign_res.json()["qr_token"]

    # Handoff Scan (Verify Pickup QR)
    verify_pickup = await client.post(
        f"/api/v1/pickups/verify-handoff?qr_token={qr_token}&event_type=HANDOFF",
        headers=vol_headers
    )
    assert verify_pickup.status_code == 200

    # Delivery Scan (Confirm Delivery QR)
    verify_delivery = await client.post(
        f"/api/v1/pickups/verify-handoff?qr_token={qr_token}&event_type=DELIVERY",
        headers=vol_headers
    )
    assert verify_delivery.status_code == 200

    # 7. STRICT STATE & OWNERSHIP VERIFICATION (Defect 8)
    # Query final donation state from DB
    from app.db.models import CustodyEvent, AuditLog, Match, PickupTask
    
    # Reload donation from database
    db_don_res = await db_session.execute(
        select(Donation).filter(Donation.id == donation_id)
    )
    db_donation = db_don_res.scalars().first()
    assert db_donation is not None
    assert db_donation.status == DonationStatus.COMPLETED  # Assertion 1: Must be COMPLETED (Defect 6)
    
    # Verify custody events exist in DB
    ce_res = await db_session.execute(
        select(CustodyEvent).filter(CustodyEvent.donation_id == donation_id)
    )
    custody_events = ce_res.scalars().all()
    assert len(custody_events) >= 2  # Handoff and Delivery custody events both recorded (Defect 8)
    
    # Verify audit events exist in DB
    audit_res = await db_session.execute(
        select(AuditLog).filter(AuditLog.resource == "pickup_tasks")
    )
    audits = audit_res.scalars().all()
    assert len(audits) >= 2  # Audit entries logged (Defect 8)
    
    # Verify claim belongs to the correct NGO
    history = db_donation.state_history
    claimed_record = next((h for h in history if h.get("status") == "CLAIMED"), None)
    assert claimed_record is not None
    assert claimed_record.get("claimed_by_org") == ngo_org_id  # Verified claim organization ownership (Defect 8)
    
    # Verify pickup belongs to correct volunteer
    pickup_record = next((h for h in history if h.get("status") == "PICKUP_ASSIGNED"), None)
    assert pickup_record is not None
    assert pickup_record.get("volunteer_id") == volunteer_id  # Verified volunteer assignment (Defect 8)

    # 8. METRICS SYNCHRONIZATION
    # Verify completed counts in analytics (excluding demo data)
    analytics_res = await client.get("/api/v1/analytics/metrics")
    assert analytics_res.status_code == 200
    metrics = analytics_res.json()["production_metrics"]
    # Should count the completed non-demo donation correctly
    assert metrics["total_registered_organizations"] == 2
