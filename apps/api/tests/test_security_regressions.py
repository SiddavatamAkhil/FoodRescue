import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, UserRole
from app.core.security import hash_password, create_access_token

@pytest.mark.asyncio
async def test_public_registration_cannot_create_admin(client: AsyncClient):
    # Attempting to register as ADMIN must fail
    res_admin = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "malicious_admin@foodrescue.org",
            "password": "attackpassword123",
            "full_name": "Malicious User",
            "role": "ADMIN"
        }
    )
    assert res_admin.status_code == 400
    assert "Public registration for administrator roles is prohibited." in res_admin.json()["detail"]

    # Attempting to register as OPS_MANAGER must fail
    res_ops = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "malicious_ops@foodrescue.org",
            "password": "attackpassword123",
            "full_name": "Malicious User",
            "role": "OPS_MANAGER"
        }
    )
    assert res_ops.status_code == 400
    assert "Public registration for administrator roles is prohibited." in res_ops.json()["detail"]

    # Registering as DONOR must succeed
    res_donor = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "valid_donor@foodrescue.org",
            "password": "validpassword123",
            "full_name": "Valid Donor",
            "role": "DONOR"
        }
    )
    assert res_donor.status_code == 201
    assert res_donor.json()["role"] == "DONOR"


@pytest.mark.asyncio
async def test_inactive_users_cannot_authenticate_or_access_routes(client: AsyncClient, db_session: AsyncSession):
    # Create an inactive user directly in database
    inactive_user = User(
        id="inactive_user_id",
        email="inactive@foodrescue.org",
        hashed_password=hash_password("inactivepass123"),
        full_name="Inactive User",
        role=UserRole.DONOR,
        is_active=False
    )
    db_session.add(inactive_user)
    await db_session.commit()

    # 1. Login attempt must fail
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": "inactive@foodrescue.org", "password": "inactivepass123"}
    )
    assert login_res.status_code == 400
    assert "Inactive user account" in login_res.json()["detail"]

    # 2. Access with valid JWT issued for inactive user must be rejected with 401
    token = create_access_token(subject=inactive_user.id)
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 401
