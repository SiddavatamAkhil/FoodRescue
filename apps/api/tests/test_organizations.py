import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, UserRole, OrgType, VerificationStatus

@pytest.mark.asyncio
async def test_create_and_verify_organization(client: AsyncClient, db_session: AsyncSession):
    # Register donor user
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "donor_admin@foodrescue.org",
            "password": "securepassword",
            "full_name": "Donor Admin",
            "role": "DONOR"
        }
    )
    assert reg_response.status_code == 201

    # Login
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "donor_admin@foodrescue.org",
            "password": "securepassword"
        }
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Organization
    create_response = await client.post(
        "/api/v1/organizations/",
        headers=headers,
        json={
            "name": "Nellore Surplus Feeds",
            "type": "DONOR",
            "fssai_number": "12345678901234",
            "address": "Nellore, Andhra Pradesh",
            "latitude": 14.4426,
            "longitude": 79.9865
        }
    )
    assert create_response.status_code == 201
    org_data = create_response.json()
    assert org_data["name"] == "Nellore Surplus Feeds"
    assert org_data["verification_status"] == "PENDING"
    org_id = org_data["id"]

    # Create Admin User directly in database (since public registration prohibits ADMIN role creation)
    from app.core.security import hash_password
    admin_user = User(
        id="admin_org_test_id",
        email="admin@foodrescue.org",
        hashed_password=hash_password("adminpassword"),
        full_name="System Admin",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()

    admin_login = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "admin@foodrescue.org",
            "password": "adminpassword"
        }
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify Organization as Admin
    verify_response = await client.post(
        f"/api/v1/organizations/{org_id}/verify",
        headers=admin_headers,
        json={
            "status": "VERIFIED",
            "notes": "FSSAI license verified successfully"
        }
    )
    assert verify_response.status_code == 200
    assert verify_response.json()["verification_status"] == "VERIFIED"
