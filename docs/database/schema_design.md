# Database Schema Design

The schema is built on a highly-normalized relational model using PostgreSQL, PostGIS, and pgvector.

## Primary Entities
- `users`: Core profile data with hashed password (Argon2id) and system role.
- `organizations`: Verified or pending food businesses and recipient NGOs.
- `memberships`: Explicit mapping connecting users to organizations with role scopes.
- `donations`: Food listings with strict state constraints and geolocation coordinates.
- `pickup_tasks`: Logistical tracking linking volunteers to claims.
- `custody_events`: Single-use QR custody transaction auditing.
- `audit_logs`: Immutable, non-modifiable trails of all high-value system events.
- `knowledge_documents` / `knowledge_chunks`: Authority texts chunked and embedded (vector) for RAG support.
