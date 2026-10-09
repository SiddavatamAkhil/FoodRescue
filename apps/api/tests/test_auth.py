import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User, UserRole, Organization, Membership, OrgRole, OrgType
from app.api.deps import verify_org_membership
from fastapi import HTTPException
import uuid

@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@foodrescue.org",
            "password": "strongpassword123",
            "full_name": "Test User",
            "role": "DONOR"
        }
    )
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    assert reg_data["email"] == "test@foodrescue.org"

    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@foodrescue.org",
            "password": "strongpassword123"
        }
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data


@pytest.mark.asyncio
async def test_organization_isolation(db_session: AsyncSession):
    # Create two users and two organizations
    u1 = User(id="user1", email="u1@foodrescue.org", hashed_password="...", full_name="User 1", role=UserRole.DONOR)
    u2 = User(id="user2", email="u2@foodrescue.org", hashed_password="...", full_name="User 2", role=UserRole.DONOR)
    
    org1 = Organization(id="org1", name="Org 1", type=OrgType.DONOR, address="Address 1", latitude=16.5, longitude=80.6)
    org2 = Organization(id="org2", name="Org 2", type=OrgType.DONOR, address="Address 2", latitude=16.5, longitude=80.6)
    
    m1 = Membership(id="m1", user_id="user1", organization_id="org1", role=OrgRole.MEMBER)
    m2 = Membership(id="m2", user_id="user2", organization_id="org2", role=OrgRole.MEMBER)
    
    db_session.add_all([u1, u2, org1, org2, m1, m2])
    await db_session.commit()
    
    # Verify that user1 can access org1 but not org2
    res = await verify_org_membership(org_id="org1", current_user=u1, db=db_session)
    assert res is not None
    assert res.organization_id == "org1"
    
    # user1 accessing org2 should raise 403 HTTP Exception
    with pytest.raises(HTTPException) as exc_info:
        await verify_org_membership(org_id="org2", current_user=u1, db=db_session)
    assert exc_info.value.status_code == 403
