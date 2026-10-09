# Architectural Decisions (ADR)

## ADR 1: Dual-Coordinate System (SQLite compatibility)
- **Problem:** PostGIS is excellent for production spatial operations, but makes writing fast, simple, in-memory SQLite unit tests extremely difficult.
- **Decision:** Implement dual-coordinate storage: float `latitude` and `longitude` fields are stored directly in parallel to any PostGIS spatial geography columns.
- **Impact:** Allows local tests to execute on SQLite in under 1 second without full PostGIS database requirements, while keeping full PostGIS index performance in production compose environments.
