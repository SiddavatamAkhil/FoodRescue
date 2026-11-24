"""Create all tables in a local SQLite database for development without Docker.

    python -m app.scripts.init_local_db

PostgreSQL deployments use Alembic migrations instead (`alembic upgrade head`).
"""
import asyncio

from app.core.config import settings
from app.db.session import Base, engine
import app.db.models  # noqa: F401  (registers all tables)


async def main() -> None:
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("DATABASE_URL is not SQLite. For PostgreSQL run: alembic upgrade head")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print(f"Local database ready: {settings.DATABASE_URL}")


if __name__ == "__main__":
    asyncio.run(main())
