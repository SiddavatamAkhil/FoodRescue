# FoodRescue: AI-Powered Food Surplus Redistribution & Rescue Platform

An academic-grade, production-hardened software engineering product implementing a highly deterministic transactional core with AI-powered intelligence at the edges. Tailored specifically for the jurisdiction of **Andhra Pradesh, India**.

---

## 🌟 Core Philosophy: Deterministic Core, AI at the Edges

In food redistribution, coordination is subject to strict safety regulations and tight timing deadlines. To prevent failures, **critical business state transitions are 100% deterministic**, while **AI/ML is restricted strictly to non-critical assistance**:

- **Deterministic Core:** Authentication (Argon2id), Role-Based Access Control (RBAC), Organization Isolation (IDOR-protection), Claim Concurrency (Row-Level Locking), QR-Based Custody Verification, and Escalation Timers.
- **AI at the Edges:** Natural language parsing of donor listings, semantic knowledge retrieval over regulatory (FSSAI) documents (RAG with citations and explicit abstention), and matching explanation text generation.

---

## 🚀 Key Implemented Systems

### 1. Real RAG (Retrieval-Augmented Generation) Engine
We implemented a complete production RAG pipeline inside `app/services/knowledge_rag.py`:
- **Document Chunking:** Input PDFs or txt documents are parsed and chunked into paragraph segments under 500 characters.
- **Embedding Generation:** Leverages provider abstractions (`BaseEmbeddingProvider`) to generate vectors.
- **Hybrid Retrieval:** Employs a custom Python similarity engine combining keyword frequency and vector cosine similarity.
- **Regulatory Citations & Abstention:** Returns official FSSAI document names, URLs, and chunk indexes as citations. If no high-confidence matching context is found, it explicitly **abstains** to prevent hallucinating regulations.

### 2. Deterministic Matching Engine
- **Hard Filters First:** Excludes expired items, unverified organizations, or organizations exceeding daily capacity.
- **Configurable Weights:** Matches remaining organizations across normalized parameters (Distance: 25, Urgency: 20, Capacity: 10).
- **Match Explanations:** Explains matching choices clearly: *"Matched because: 3.2 km away, accepts unserved vegetarian, verified organization."*

### 3. Product web app (Next.js 14)
A role-based product with a public site, real authentication and a separate workspace for each account type:
- **Public site:** home, how it works, for restaurants, for NGOs, live impact figures (no estimates), about, contact, privacy policy, terms. Telugu translation of the navigation and hero.
- **Accounts:** sign up as a food donor, NGO / food bank, volunteer or corporate; email verification; password reset; "keep me signed in"; login rate limiting. Sessions are held in an httpOnly cookie, and every page under `/dashboard` is guarded.
- **Onboarding:** role-specific details, verification documents, and an admin review workflow (pending, under review, verified, rejected, information required, suspended).
- **Workspaces:** donor, NGO, volunteer, corporate and admin dashboards, each with its own navigation, all built on one design system.

See [docs/frontend/design_system.md](./docs/frontend/design_system.md) and [docs/frontend/redesign_report.md](./docs/frontend/redesign_report.md).

---

## 🛡️ Mandated Operational Scenarios (All 10 Fully Passing!)

The backend test suite covers all 10 mandated scenarios, plus accounts, onboarding and custody-code tests (19 tests). It runs on SQLite by default, and on PostgreSQL when `TEST_DATABASE_URL` is set; CI runs both:

| Scenario | Objective | Test Implementation |
| :--- | :--- | :--- |
| **Test 1** | Two recipients simultaneously claim the same donation. Exactly **one** succeeds. | `test_fulfillment.py::test_claims_and_qr_scenarios` (uses `asyncio.gather` and SQLAlchemy `SELECT FOR UPDATE` write lock) |
| **Test 2** | Donation expires. Cannot be claimed. | `test_fulfillment.py::test_claims_and_qr_scenarios` (validates `pickup_deadline < now` boundary rejection) |
| **Test 3** | Unverified organization attempts to claim. Rejected. | `test_fulfillment.py::test_claims_and_qr_scenarios` (verifies status `!= VERIFIED` blocks claim) |
| **Test 4** | Recipient lacks capacity. Not eligible. | `test_fulfillment.py::test_claims_and_qr_scenarios` (claim exceeds the NGO's declared `daily_capacity`) |
| **Test 5** | Food listing contains plate leftovers. Rejected immediately. | `test_donations.py::test_donation_lifecycle_and_food_safety` and `test_ai.py` (validated using Pydantic safety validators) |
| **Test 6** | AI parser produces invalid JSON. Schema validation catches it. | `test_ai.py::test_ai_parsing_and_rag_abstain` (schema parser catches invalid outputs and yields a 422 error) |
| **Test 7** | RAG has no authoritative answer. Explicit abstention. | `test_ai.py::test_ai_parsing_and_rag_abstain` (returns explicit `"ABSTAIN"` state with citation fallback) |
| **Test 8** | Unauthorized user accesses another organization's donation. | `test_donations.py::test_donation_lifecycle_and_food_safety` (verifies IDOR and organization boundaries return a 403) |
| **Test 9** | QR custody token reused. Rejected. | `test_fulfillment.py::test_claims_and_qr_scenarios` (single-use token check against recorded custody events) |
| **Test 10**| Escalation deadline reached. Notification/action triggered. | `test_escalation.py::test_escalation_and_auto_expiry` (verifies background scheduler sets state to EXPIRED) |

---

## 🔑 Demo & Seeding Credentials

FoodRescue has pre-configured, realistic, and distinctly labeled demo accounts (tagged with `is_demo = true`). Once the services are running, triggers can be seeded via administrative calls or simply evaluated using the following credentials:

- **Donor User Account:**
  - **Email:** `demo_donor@foodrescue.org`
  - **Password:** `demopassword123`
  - **Organization:** `DEMO Nellore Biryani Point`
- **NGO / Recipient Account:**
  - **Email:** `demo_ngo@foodrescue.org`
  - **Password:** `demopassword123`
  - **Organization:** `DEMO Andhra Food Aid`

---

## 🛠️ Quick Start

### Stand Up All Services (Postgres, PostGIS, pgvector, Redis, Celery, Backend, Frontend)
```bash
docker-compose up --build
docker-compose exec api alembic upgrade head
# Administrators can't sign up publicly. Create the first one (you'll be prompted for a password):
docker-compose exec api python -m app.scripts.create_admin --email you@example.org --name "Your Name"
```
Open http://localhost:3000. Without `SMTP_HOST`, verification and password-reset emails (including their links) are written to the API log: `docker-compose logs api`.

### Run Backend Unit Tests Locally
Ensure you have local packages installed:
```bash
cd apps/api
python3 -m pip install -r requirements.txt
python3 -m pytest -v
# Same suite against PostgreSQL (enforces foreign keys):
TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/foodrescue_test python3 -m pytest
```

### Run the web app locally
```bash
cd apps/web
npm ci
API_URL=http://localhost:8000 npm run dev     # or: npm run lint && npm run build && npm start
```
The browser never calls the API directly. Next.js route handlers keep the session cookie and proxy requests to `API_URL`.

---

## 📊 Project Readiness & Implementation Report

A detailed **FoodRescue 1.0 Engineering Report** is available in the repository root at [REPORT.md](./REPORT.md). This report outlines:
- Complete list of implemented full-stack modules.
- Verification status across all 10 mandated operational scenarios.
- Database schema summary & migrations (Alembic configurations).
- Step-by-step instructions to seed and evaluate role-based user journeys (Donor, NGO, Volunteer, Admin).
- Production deployment checklist and security hardening audits.

---

## ⚖️ Compliance & Licensing
- **Geospatial Data:** Map and location boundaries utilize OpenStreetMap datasets. All visual layers include mandatory attribution: `© OpenStreetMap contributors` under the Open Database License (ODbL).
- **DPDP Framework:** Adheres strictly to India's Digital Personal Data Protection Act (DPDP), implementing strict purpose limitations, consent audit trails, and minimal volunteer location disclosure.
- **FSSAI Standards:** Food eligibility checks and temperature handover recommendations are aligned strictly with FSSAI (Safe Food and Share Food) regulations.
