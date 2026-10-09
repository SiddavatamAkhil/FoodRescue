# Docker & Production Deployment

## Local Development
Stand up all database, cache, workers, backend and frontend instances easily via Compose:
```bash
docker-compose up --build
```

## Production Requirements
- **Database:** Managed Postgres (AWS RDS or equivalent) with PostGIS and pgvector extensions active.
- **Cache:** High availability Redis cluster for Celery task brokers and session/SSE state caches.
- **Secrets Management:** Secrets must be injected into the system via secure environment variables (not committed to git).
