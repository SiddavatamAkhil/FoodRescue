"""Accounts, sessions, onboarding and role workflows added with the product redesign."""
import re
from datetime import datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import User, UserRole

PASSWORD = "Rescue2026"


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    async def fake_send(to, subject, body):
        sent.append({"to": to, "subject": subject, "body": body})

    monkeypatch.setattr("app.api.auth.send_email", fake_send)
    return sent


def _token_from(mail: dict) -> str:
    return re.search(r"token=([A-Za-z0-9_\-]+)", mail["body"]).group(1)


async def register(client, email, role, password=PASSWORD, **extra):
    payload = {"email": email, "password": password, "full_name": "Test Person", "role": role, "accept_terms": True}
    payload.update(extra)
    return await client.post("/api/v1/auth/register", json=payload)


async def login(client, email, password=PASSWORD, remember=False):
    data = {"username": email, "password": password}
    if remember:
        data["remember"] = "true"
    res = await client.post("/api/v1/auth/login", data=data)
    return res


async def auth_headers(client, email, role, **extra):
    r = await register(client, email, role, **extra)
    assert r.status_code == 201, r.text
    res = await login(client, email)
    return {"Authorization": f"Bearer {res.json()['access_token']}"}, r.json()["id"]


LOCATION = {"address": "12-4 MG Road, Benz Circle", "city": "Vijayawada", "latitude": 16.5062, "longitude": 80.6480}

DONOR_ONBOARDING = {
    "business_name": "Krishna Caterers",
    "business_category": "caterer",
    "location": LOCATION,
    "contact_name": "Ravi Kumar",
    "contact_phone": "+919876543210",
    "fssai_number": "12345678901234",
    "operating_hours": "08:00-22:00",
    "food_categories": ["cooked_veg"],
}

NGO_ONBOARDING = {
    "organization_name": "Annapurna Seva Trust",
    "registration_number": "AP/2019/0233456",
    "location": {**LOCATION, "latitude": 16.51, "longitude": 80.65},
    "operating_locations": ["Vijayawada"],
    "contact_name": "Lakshmi Devi",
    "contact_phone": "+919876500000",
    "daily_meal_capacity": 300,
    "food_categories": ["cooked_veg", "dry_rations"],
}


@pytest.mark.asyncio
async def test_registration_rules(client: AsyncClient, outbox):
    no_terms = await client.post("/api/v1/auth/register", json={
        "email": "a@example.org", "password": PASSWORD, "full_name": "A Person", "role": "DONOR"})
    assert no_terms.status_code == 400 and "Terms" in no_terms.json()["detail"]

    weak = await register(client, "b@example.org", "DONOR", password="short")
    assert weak.status_code == 400 and "8 characters" in weak.json()["detail"]

    ok = await register(client, "Mixed@Example.org", "CORPORATE", phone="+91 98765 43210")
    assert ok.status_code == 201
    assert ok.json()["email"] == "mixed@example.org"
    assert ok.json()["email_verified"] is False

    dup = await register(client, "mixed@example.org", "DONOR")
    assert dup.status_code == 400
    dup_phone = await register(client, "c@example.org", "DONOR", phone="+919876543210")
    assert dup_phone.status_code == 400 and "phone" in dup_phone.json()["detail"]

    bad_phone = await register(client, "d@example.org", "DONOR", phone="12ab")
    assert bad_phone.status_code == 422

    assert outbox and outbox[0]["to"] == "mixed@example.org"


@pytest.mark.asyncio
async def test_email_verification_and_password_reset(client: AsyncClient, outbox):
    headers, _ = await auth_headers(client, "verify@example.org", "VOLUNTEER")
    token = _token_from(outbox[-1])

    assert (await client.post("/api/v1/auth/verify-email", json={"token": "x" * 20})).status_code == 400
    assert (await client.post("/api/v1/auth/verify-email", json={"token": token})).status_code == 200
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["email_verified"] is True
    # Single use
    assert (await client.post("/api/v1/auth/verify-email", json={"token": token})).status_code == 400

    unknown = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.org"})
    known = await client.post("/api/v1/auth/forgot-password", json={"email": "verify@example.org"})
    assert unknown.json() == known.json()  # no account enumeration
    reset_token = _token_from(outbox[-1])
    weak = await client.post("/api/v1/auth/reset-password", json={"token": reset_token, "password": "abc"})
    assert weak.status_code == 400
    ok = await client.post("/api/v1/auth/reset-password", json={"token": reset_token, "password": "NewPass2026"})
    assert ok.status_code == 200
    assert (await login(client, "verify@example.org")).status_code == 400
    assert (await login(client, "verify@example.org", "NewPass2026")).status_code == 200


@pytest.mark.asyncio
async def test_login_rate_limit_and_session_lifetime(client: AsyncClient, outbox):
    await register(client, "limit@example.org", "DONOR")
    normal = await login(client, "limit@example.org")
    remembered = await login(client, "limit@example.org", remember=True)
    assert normal.json()["expires_in"] == settings.SESSION_EXPIRE_MINUTES * 60
    assert remembered.json()["expires_in"] == settings.REMEMBER_ME_EXPIRE_DAYS * 86400
    exp = jwt.decode(remembered.json()["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])["exp"]
    assert exp > (datetime.utcnow() + timedelta(days=6)).timestamp()

    for _ in range(settings.LOGIN_MAX_FAILURES):
        assert (await login(client, "limit@example.org", "WrongPass1")).status_code == 400
    blocked = await login(client, "limit@example.org")
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_role_onboarding_creates_profiles(client: AsyncClient, outbox):
    donor_h, _ = await auth_headers(client, "donor@example.org", "DONOR")
    bad = await client.post("/api/v1/auth/onboarding", headers=donor_h, json={**DONOR_ONBOARDING, "food_categories": []})
    assert bad.status_code == 422
    res = await client.post("/api/v1/auth/onboarding", headers=donor_h, json=DONOR_ONBOARDING)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["onboarding_completed"] is True
    assert body["organization"]["type"] == "DONOR"
    assert body["organization"]["verification_status"] == "PENDING"

    vol_h, _ = await auth_headers(client, "vol@example.org", "VOLUNTEER")
    res = await client.post("/api/v1/auth/onboarding", headers=vol_h, json={
        "contact_phone": "+919800000001", "service_area": "Vijayawada", "latitude": 16.5, "longitude": 80.64,
        "available_days": ["sat", "sun"], "available_from": "09:00", "available_to": "18:00",
        "vehicle_type": "two_wheeler", "vehicle_capacity_kg": 25})
    assert res.status_code == 200, res.text
    assert res.json()["volunteer"]["service_area"] == "Vijayawada"
    assert res.json()["organization"] is None

    corp_h, _ = await auth_headers(client, "corp@example.org", "CORPORATE")
    res = await client.post("/api/v1/auth/onboarding", headers=corp_h, json={
        "company_name": "Coastal Foods Pvt Ltd", "industry": "Food processing", "location": LOCATION,
        "representative_name": "S. Rao", "representative_designation": "CSR Lead",
        "contact_email": "csr@coastal.example", "contact_phone": "+919811111111",
        "branches": [{"name": "Guntur unit", "address": "Industrial Estate, Guntur"}]})
    assert res.status_code == 200, res.text
    assert res.json()["organization"]["type"] == "CORPORATE"
    assert len(res.json()["organization"]["profile"]["branches"]) == 1


async def _make_admin(db_session) -> None:
    db_session.add(User(id="admin_x", email="admin@example.org", hashed_password=hash_password(PASSWORD),
                        full_name="Admin", role=UserRole.ADMIN, is_active=True))
    await db_session.commit()


@pytest.mark.asyncio
async def test_verification_decisions_and_full_rescue(client: AsyncClient, db_session: AsyncSession, outbox):
    await _make_admin(db_session)
    admin_h = {"Authorization": f"Bearer {(await login(client, 'admin@example.org')).json()['access_token']}"}

    donor_h, _ = await auth_headers(client, "d1@example.org", "DONOR")
    donor_org = (await client.post("/api/v1/auth/onboarding", headers=donor_h, json=DONOR_ONBOARDING)).json()["organization"]["id"]
    ngo_h, _ = await auth_headers(client, "n1@example.org", "RECIPIENT")
    ngo_org = (await client.post("/api/v1/auth/onboarding", headers=ngo_h, json=NGO_ONBOARDING)).json()["organization"]["id"]
    other_ngo_h, _ = await auth_headers(client, "n2@example.org", "RECIPIENT")
    await client.post("/api/v1/auth/onboarding", headers=other_ngo_h, json={**NGO_ONBOARDING, "organization_name": "Other Trust"})

    # Non-admins cannot verify; INFO_REQUIRED needs a note; resubmission returns case to PENDING.
    assert (await client.post(f"/api/v1/organizations/{ngo_org}/verify", headers=ngo_h, json={"status": "VERIFIED"})).status_code == 403
    no_note = await client.post(f"/api/v1/organizations/{ngo_org}/verify", headers=admin_h, json={"status": "INFO_REQUIRED"})
    assert no_note.status_code == 400
    await client.post(f"/api/v1/organizations/{ngo_org}/verify", headers=admin_h,
                      json={"status": "INFO_REQUIRED", "notes": "Upload the trust deed."})
    me = (await client.get("/api/v1/auth/me", headers=ngo_h)).json()
    assert me["organization"]["verification_status"] == "INFO_REQUIRED"
    assert me["organization"]["verification_notes"] == "Upload the trust deed."
    notes = (await client.get("/api/v1/notifications/", headers=ngo_h)).json()
    assert any("trust deed" in n["message"] for n in notes)
    await client.post("/api/v1/auth/onboarding", headers=ngo_h, json=NGO_ONBOARDING)
    assert (await client.get("/api/v1/auth/me", headers=ngo_h)).json()["organization"]["verification_status"] == "PENDING"

    # Unverified donors can draft but not publish.
    listing = {
        "title": "Veg biryani, 40 portions", "pickup_address": "12-4 MG Road, Vijayawada",
        "pickup_deadline": (datetime.utcnow() + timedelta(hours=4)).isoformat(),
        "latitude": 16.5062, "longitude": 80.6480,
        "food_items": [{"name": "Veg biryani", "quantity": 40, "unit": "meals", "is_veg": True,
                        "prep_time": datetime.utcnow().isoformat(),
                        "expiry_time": (datetime.utcnow() + timedelta(hours=6)).isoformat(), "is_leftover": False}],
    }
    past = {**listing, "pickup_deadline": (datetime.utcnow() - timedelta(hours=1)).isoformat()}
    assert (await client.post(f"/api/v1/donations/?org_id={donor_org}", headers=donor_h, json=past)).status_code == 422
    don = (await client.post(f"/api/v1/donations/?org_id={donor_org}", headers=donor_h, json=listing)).json()
    pub = await client.post(f"/api/v1/donations/{don['id']}/transition", headers=donor_h, json={"status": "PUBLISHED"})
    assert pub.status_code == 400

    for org in (donor_org, ngo_org):
        await client.post(f"/api/v1/organizations/{org}/verify", headers=admin_h, json={"status": "VERIFIED"})

    # Another organization cannot publish someone else's listing.
    assert (await client.post(f"/api/v1/donations/{don['id']}/transition", headers=ngo_h,
                              json={"status": "PUBLISHED"})).status_code == 403
    assert (await client.post(f"/api/v1/donations/{don['id']}/transition", headers=donor_h,
                              json={"status": "PUBLISHED"})).status_code == 200

    mine = await client.get(f"/api/v1/donations/?org_id={donor_org}", headers=donor_h)
    assert [d["id"] for d in mine.json()] == [don["id"]]
    assert (await client.get(f"/api/v1/donations/?org_id={donor_org}", headers=ngo_h)).status_code == 403

    avail = (await client.get("/api/v1/donations/available", headers=ngo_h)).json()
    assert avail["organization_verified"] is True
    assert avail["donations"][0]["id"] == don["id"] and avail["donations"][0]["distance_km"] < 5

    # A user cannot claim on behalf of an organization they do not belong to.
    idor = await client.post(f"/api/v1/claims/donation/{don['id']}?org_id={ngo_org}", headers=other_ngo_h)
    assert idor.status_code == 403
    claim = await client.post(f"/api/v1/claims/donation/{don['id']}?org_id={ngo_org}", headers=ngo_h)
    assert claim.status_code == 201
    claims = (await client.get(f"/api/v1/claims/organization/{ngo_org}", headers=ngo_h)).json()
    assert claims[0]["id"] == don["id"]

    # Volunteer accepts; codes go to donor (pickup) and recipient (delivery), never to the volunteer.
    vol_h, _ = await auth_headers(client, "v1@example.org", "VOLUNTEER")
    early = await client.post(f"/api/v1/pickups/accept/{don['id']}", headers=vol_h)
    assert early.status_code == 400  # profile required
    await client.post("/api/v1/auth/onboarding", headers=vol_h, json={
        "contact_phone": "+919800000002", "service_area": "Vijayawada", "latitude": 16.5, "longitude": 80.64,
        "available_days": ["mon"], "available_from": "09:00", "available_to": "18:00"})
    tasks = (await client.get("/api/v1/pickups/available", headers=vol_h)).json()["tasks"]
    assert tasks[0]["donation_id"] == don["id"] and tasks[0]["dropoff_name"] == "Annapurna Seva Trust"
    assert (await client.post(f"/api/v1/pickups/accept/{don['id']}", headers=vol_h)).status_code == 201
    assert (await client.post(f"/api/v1/pickups/accept/{don['id']}", headers=vol_h)).status_code == 400

    my = (await client.get("/api/v1/pickups/mine", headers=vol_h)).json()
    assert my[0]["status"] == "ASSIGNED" and "qr_token" not in my[0]
    donor_view = (await client.get(f"/api/v1/pickups/donation/{don['id']}", headers=donor_h)).json()["task"]
    ngo_view = (await client.get(f"/api/v1/pickups/donation/{don['id']}", headers=ngo_h)).json()["task"]
    assert donor_view["pickup_code"] and donor_view["delivery_code"] is None
    assert ngo_view["delivery_code"] and ngo_view["pickup_code"] is None
    assert (await client.get(f"/api/v1/pickups/donation/{don['id']}", headers=vol_h)).status_code == 403

    wrong = await client.post(f"/api/v1/pickups/verify-handoff?qr_token={ngo_view['delivery_code']}&event_type=HANDOFF", headers=vol_h)
    assert wrong.status_code == 400
    assert (await client.post(f"/api/v1/pickups/verify-handoff?qr_token={donor_view['pickup_code']}&event_type=HANDOFF", headers=vol_h)).status_code == 200
    assert (await client.post(f"/api/v1/pickups/verify-handoff?qr_token={donor_view['pickup_code']}&event_type=DELIVERY", headers=vol_h)).status_code == 400
    assert (await client.post(f"/api/v1/pickups/verify-handoff?qr_token={ngo_view['delivery_code']}&event_type=DELIVERY", headers=vol_h)).status_code == 200

    report = (await client.get(f"/api/v1/analytics/organization/{donor_org}", headers=donor_h)).json()
    assert report["completed"] == 1 and report["quantity_rescued"] == 40
    assert report["completion_rate"] == 1.0
    ngo_report = (await client.get(f"/api/v1/analytics/organization/{ngo_org}", headers=ngo_h)).json()
    assert ngo_report["quantity_rescued"] == 40
    assert (await client.get("/api/v1/analytics/volunteer", headers=vol_h)).json()["delivered"] == 1

    overview = (await client.get("/api/v1/admin/overview", headers=admin_h)).json()
    assert overview["completed_rescues"] == 1
    assert (await client.get("/api/v1/admin/overview", headers=donor_h)).status_code == 403
    users = (await client.get("/api/v1/admin/users?q=example.org&limit=2", headers=admin_h)).json()
    assert users["total"] >= 5 and len(users["items"]) == 2
    logs = (await client.get("/api/v1/admin/audit-logs", headers=admin_h)).json()
    assert all("qr_token" not in (log["after"] or {}) for log in logs["items"])


@pytest.mark.asyncio
async def test_incidents_contact_and_documents(client: AsyncClient, db_session: AsyncSession, outbox):
    await _make_admin(db_session)
    admin_h = {"Authorization": f"Bearer {(await login(client, 'admin@example.org')).json()['access_token']}"}
    donor_h, _ = await auth_headers(client, "d2@example.org", "DONOR")
    org = (await client.post("/api/v1/auth/onboarding", headers=donor_h, json=DONOR_ONBOARDING)).json()["organization"]["id"]

    bad = await client.post(f"/api/v1/organizations/{org}/documents", headers=donor_h,
                            data={"document_type": "fssai_license"},
                            files={"file": ("licence.pdf", b"not a pdf", "application/pdf")})
    assert bad.status_code == 400
    good = await client.post(f"/api/v1/organizations/{org}/documents", headers=donor_h,
                             data={"document_type": "fssai_license"},
                             files={"file": ("licence.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert good.status_code == 201
    docs = (await client.get(f"/api/v1/organizations/{org}/documents", headers=donor_h)).json()
    assert docs[0]["document_type"] == "fssai_license"
    file_res = await client.get(f"/api/v1/organizations/{org}/documents/{docs[0]['id']}/file", headers=admin_h)
    assert file_res.status_code == 200 and file_res.content.startswith(b"%PDF")

    inc = await client.post("/api/v1/incidents/", headers=donor_h,
                            json={"category": "no_show", "description": "Volunteer did not arrive by deadline."})
    assert inc.status_code == 201
    assert len((await client.get("/api/v1/incidents/", headers=donor_h)).json()) == 1
    assert (await client.patch(f"/api/v1/incidents/{inc.json()['id']}", headers=donor_h, json={"status": "RESOLVED"})).status_code == 403
    assert (await client.patch(f"/api/v1/incidents/{inc.json()['id']}", headers=admin_h, json={"status": "RESOLVED"})).status_code == 200

    msg = await client.post("/api/v1/contact/", json={"name": "Priya", "email": "priya@example.org",
                                                      "topic": "ngo", "message": "We run a shelter in Guntur."})
    assert msg.status_code == 201
    assert (await client.get("/api/v1/admin/contact-messages", headers=admin_h)).json()[0]["name"] == "Priya"


@pytest.mark.asyncio
async def test_timezone_aware_times_are_normalised(client: AsyncClient, db_session: AsyncSession, outbox):
    """Browsers send ISO strings with an offset; they must be stored as naive UTC."""
    await _make_admin(db_session)
    donor_h, _ = await auth_headers(client, "tz@example.org", "DONOR")
    org = (await client.post("/api/v1/auth/onboarding", headers=donor_h, json=DONOR_ONBOARDING)).json()["organization"]["id"]
    now = datetime.utcnow()
    res = await client.post(f"/api/v1/donations/?org_id={org}", headers=donor_h, json={
        "title": "Idli, 30 portions", "pickup_address": "12-4 MG Road, Vijayawada",
        "pickup_deadline": (now + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "latitude": 16.5, "longitude": 80.6,
        "food_items": [{"name": "Idli", "quantity": 30, "unit": "meals", "is_veg": True,
                        "prep_time": (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                        "expiry_time": (now + timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "is_leftover": False}],
    })
    assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_demo_seed_is_idempotent_and_ready_to_use(client: AsyncClient, db_session: AsyncSession, outbox):
    await _make_admin(db_session)
    admin_h = {"Authorization": f"Bearer {(await login(client, 'admin@example.org')).json()['access_token']}"}
    assert (await client.post("/api/v1/admin/seed-demo", headers=admin_h)).status_code == 201
    assert (await client.post("/api/v1/admin/seed-demo", headers=admin_h)).status_code == 201
    res = await login(client, "demo_ngo@foodrescue.org", "demopassword123")
    assert res.json()["onboarding_completed"] is True
    ngo_h = {"Authorization": f"Bearer {res.json()['access_token']}"}
    avail = (await client.get("/api/v1/donations/available", headers=ngo_h)).json()
    assert avail["donations"][0]["food_items"][0]["quantity"] == 50
