import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_donation_lifecycle_and_food_safety(client: AsyncClient):
    # Register donor
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "donor@foodrescue.org",
            "password": "donorpassword",
            "full_name": "Donor User",
            "role": "DONOR"
        }
    )
    token = client.post(
        "/api/v1/auth/login",
        data={"username": "donor@foodrescue.org", "password": "donorpassword"}
    )
    tok_data = (await token).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok_data}"}

    # Create Organization
    org_res = await client.post(
        "/api/v1/organizations/",
        headers=headers,
        json={
            "name": "Kurnool Caterers",
            "type": "DONOR",
            "address": "Kurnool, AP",
            "latitude": 15.8284,
            "longitude": 78.0373
        }
    )
    org_id = org_res.json()["id"]

    # Test 5: Rejection of plate leftovers (validation check)
    bad_donation_payload = {
        "title": "Biryani Plate Leftovers",
        "pickup_address": "Kurnool Main Road",
        "pickup_deadline": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        "latitude": 15.8284,
        "longitude": 78.0373,
        "food_items": [
            {
                "name": "Veg Biryani",
                "quantity": 10.0,
                "unit": "meals",
                "is_veg": True,
                "prep_time": datetime.utcnow().isoformat(),
                "expiry_time": (datetime.utcnow() + timedelta(hours=4)).isoformat(),
                "is_leftover": True # Leftovers/Plate food
            }
        ]
    }
    
    bad_res = await client.post(
        f"/api/v1/donations/?org_id={org_id}",
        headers=headers,
        json=bad_donation_payload
    )
    # Assert validation failure
    assert bad_res.status_code == 422
    assert "Plate leftovers or consumer-exposed food are ineligible" in bad_res.text

    # Submit valid unserved food donation
    good_donation_payload = {
        "title": "Fresh Unserved Biryani Boxes",
        "pickup_address": "Kurnool Event Hall",
        "pickup_deadline": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "latitude": 15.8284,
        "longitude": 78.0373,
        "food_items": [
            {
                "name": "Paneer Biryani Packets",
                "quantity": 40.0,
                "unit": "meals",
                "is_veg": True,
                "prep_time": datetime.utcnow().isoformat(),
                "expiry_time": (datetime.utcnow() + timedelta(hours=6)).isoformat(),
                "is_leftover": False # Unserved surplus food
            }
        ]
    }
    
    good_res = await client.post(
        f"/api/v1/donations/?org_id={org_id}",
        headers=headers,
        json=good_donation_payload
    )
    assert good_res.status_code == 201
    donation_data = good_res.json()
    assert donation_data["status"] == "DRAFT"
    donation_id = donation_data["id"]

    # Transition Draft -> Published should fail if org is unverified
    pub_res = await client.post(
        f"/api/v1/donations/{donation_id}/transition",
        headers=headers,
        json={"status": "PUBLISHED"}
    )
    assert pub_res.status_code == 400 # Org must be verified first
    assert "must be VERIFIED before publishing" in pub_res.text

    # Test 8: Unauthorized user accesses another organization's draft donation (IDOR check)
    # Register a separate donor user
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "malicious_donor@foodrescue.org",
            "password": "maliciouspassword",
            "full_name": "Malicious Donor",
            "role": "DONOR"
        }
    )
    mal_login = await client.post(
        "/api/v1/auth/login",
        data={"username": "malicious_donor@foodrescue.org", "password": "maliciouspassword"}
    )
    mal_headers = {"Authorization": f"Bearer {mal_login.json()['access_token']}"}

    # Attempt to read the draft donation (should return 403 Forbidden because malicious_donor is not in org_id and status is DRAFT)
    mal_access_res = await client.get(
        f"/api/v1/donations/{donation_id}",
        headers=mal_headers
    )
    assert mal_access_res.status_code == 403
    assert "Access denied" in mal_access_res.json()["detail"]

