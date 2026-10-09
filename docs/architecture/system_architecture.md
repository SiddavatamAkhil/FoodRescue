# System Architecture

FoodRescue is designed as a **Modular Monolith** using a deterministic transactional core and AI-enhanced features at the edges.

## Components
1. **Core Database:** PostgreSQL with PostGIS for geospatial matching and pgvector for semantic knowledge retrieval.
2. **Deterministic Service Layer (FastAPI):** Handles RBAC, claim concurrency locks, and strict state transitions.
3. **Task Queue (Celery + Redis):** Handles background jobs (notification retries, auto-expiry, escalation checks).
4. **Real-time Engine (SSE):** Provides real-time event updates to the dashboards without polling.
5. **Modern Frontend (Next.js):** Communicates with the FastAPI server securely.

## Data Flow
- **Handoff & Verification:** Crytographically secured QR handoff tokens secure physical transfers.
