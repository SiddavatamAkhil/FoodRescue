"""Create or promote a platform administrator.

Public sign-up never creates administrators. Run this on the server:

    python -m app.scripts.create_admin --email ops@example.org --name "Ops Lead"

You will be prompted for a password.
"""
import argparse
import asyncio
import getpass
import uuid

from sqlalchemy.future import select

from app.core.security import hash_password, password_problems
from app.db.models import User, UserRole
from app.db.session import AsyncSessionLocal


async def main(email: str, name: str, password: str, role: str) -> None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).filter(User.email == email.lower()))
        user = res.scalars().first()
        if user:
            user.role = UserRole(role)
            user.hashed_password = hash_password(password)
            user.is_active = True
            action = "Updated"
        else:
            user = User(id=str(uuid.uuid4()), email=email.lower(), full_name=name, role=UserRole(role),
                        hashed_password=hash_password(password), is_active=True)
            db.add(user)
            action = "Created"
        user.email_verified = True
        user.onboarding_completed = True
        await db.commit()
        print(f"{action} {role} account for {email.lower()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Platform Administrator")
    parser.add_argument("--role", default="ADMIN", choices=["ADMIN", "OPS_MANAGER"])
    parser.add_argument("--password", help="Omit to be prompted (recommended)")
    args = parser.parse_args()
    from email_validator import EmailNotValidError, validate_email

    try:
        validate_email(args.email, check_deliverability=False)
    except EmailNotValidError as exc:
        raise SystemExit(f"Invalid email address: {exc}")
    pw = args.password or getpass.getpass("Password: ")
    problems = password_problems(pw)
    if problems:
        raise SystemExit("Password must contain " + ", ".join(problems))
    asyncio.run(main(args.email, args.name, pw, args.role))
