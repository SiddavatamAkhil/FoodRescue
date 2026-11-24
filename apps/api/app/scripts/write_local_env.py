"""Write local development config for running without Docker (SQLite). Existing files are kept.

    python -m app.scripts.write_local_env      (run from apps/api)
"""
import secrets
from pathlib import Path

api_env = Path(".env")
web_env = Path("../web/.env.local")

if not api_env.exists():
    api_env.write_text(
        "DATABASE_URL=sqlite+aiosqlite:///./foodrescue_local.db\n"
        "SYNC_DATABASE_URL=sqlite:///./foodrescue_local.db\n"
        f"SECRET_KEY={secrets.token_urlsafe(48)}\n"
        "ENVIRONMENT=development\n"
        "FRONTEND_URL=http://localhost:3000\n"
        "UPLOAD_DIR=./uploads\n",
        encoding="utf-8",
    )
    print("Wrote apps/api/.env")
else:
    print("Kept existing apps/api/.env")

if not web_env.exists():
    web_env.write_text("API_URL=http://127.0.0.1:8000\n", encoding="utf-8")
    print("Wrote apps/web/.env.local")
else:
    print("Kept existing apps/web/.env.local")
