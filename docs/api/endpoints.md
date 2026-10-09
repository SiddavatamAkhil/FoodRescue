# API Endpoints Guide

The backend base path is `/api/v1/`.

## Core Modules

### 1. Authentication (`/api/v1/auth`)
- `POST /register`: Registers a user (Donor, Recipient, Volunteer, Admin).
- `POST /login`: Standard OAuth2 password login, returns a JWT token.
- `GET /me`: Fetches current logged-in user profile.

### 2. Organizations (`/api/v1/organizations`)
- `POST /`: Creates an organization, automatically assigning the creator as administrator.
- `GET /{org_id}`: Fetches organization details under strict isolation checks.
- `POST /{org_id}/verify`: Admin-only endpoint to verify/reject organizations.

### 3. Claims (`/api/v1/claims`)
- `POST /donation/{donation_id}`: Concurrency-safe claim endpoint using `SELECT FOR UPDATE` locks.

### 4. AI & RAG (`/api/v1/ai`)
- `POST /parse-listing`: Extracts structured data and flags plate leftovers.
- `POST /knowledge-query`: RAG assistant with FSSAI citation and abstention capabilities.
