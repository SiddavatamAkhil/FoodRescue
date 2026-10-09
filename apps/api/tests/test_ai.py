import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.knowledge_rag import ingest_document

@pytest.mark.asyncio
async def test_ai_parsing_and_rag_abstain(client: AsyncClient, db_session: AsyncSession):
    # Ingest standard FSSAI safety document into the test DB
    await ingest_document(
        db_session,
        title="FSSAI Surplus Food Regulations 2019",
        content="The handover temperature for unserved surplus food must be kept under 4 degrees Celsius or above 60 degrees Celsius to ensure safety.",
        source_url="https://fssai.gov.in"
    )

    # Setup headers with a registered user
    await client.post(
        "/api/v1/auth/register",
        json={"email": "ai_user@foodrescue.org", "password": "aipassword", "full_name": "AI User", "role": "DONOR"}
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": "ai_user@foodrescue.org", "password": "aipassword"}
    )
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 1. Test Valid AI Parsing
    valid_res = await client.post(
        "/api/v1/ai/parse-listing",
        headers=headers,
        json={"text": "We have about 45 veg biryani boxes, prepared at 1 PM."}
    )
    assert valid_res.status_code == 200
    data = valid_res.json()
    assert data["name"] == "Fresh Veg Biryani Boxes"
    assert data["quantity"] == 45.0
    assert data["is_leftover"] is False

    # 2. Test 5: Rejection of AI parsed plate leftovers
    bad_res = await client.post(
        "/api/v1/ai/parse-listing",
        headers=headers,
        json={"text": "We have about 10 plates of leftovers after a private party."}
    )
    assert bad_res.status_code == 400
    assert "Safety Reject: This listing contains consumer-exposed plate leftovers." in bad_res.json()["detail"]

    # 3. Test 7: RAG Abstention when evidence is insufficient
    rag_abstain_res = await client.post(
        "/api/v1/ai/knowledge-query",
        headers=headers,
        json={"question": "What is the unknown regulatory standard of Guntur state?"}
    )
    assert rag_abstain_res.status_code == 200
    rag_data = rag_abstain_res.json()
    assert rag_data["status"] == "ABSTAIN"
    assert "could not find sufficient authoritative information" in rag_data["answer"]

    # 4. Test RAG successful answer with citation
    rag_ok_res = await client.post(
        "/api/v1/ai/knowledge-query",
        headers=headers,
        json={"question": "What is the handover temperature for unserved surplus?"}
    )
    assert rag_ok_res.status_code == 200
    ok_data = rag_ok_res.json()
    assert ok_data["status"] == "ANSWERED"
    assert len(ok_data["citations"]) > 0
    assert "FSSAI Surplus Food Regulations 2019" in ok_data["citations"][0]["document"]
