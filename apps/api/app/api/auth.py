import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user, get_user_organization
from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter, client_ip
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    password_problems,
    verify_password,
)
from app.db.models import (
    AuditLog,
    AuthToken,
    Membership,
    Organization,
    OrgRole,
    OrgType,
    User,
    UserRole,
    VerificationStatus,
    Volunteer,
)
from app.db.session import get_db
from app.schemas.onboarding import (
    CorporateOnboarding,
    DonorOnboarding,
    NgoOnboarding,
    VolunteerOnboarding,
)
from app.schemas.user import (
    EmailRequest,
    MeResponse,
    OrganizationSummary,
    PasswordReset,
    Token,
    TokenRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
    VolunteerSummary,
)
from app.services.mailer import send_email

router = APIRouter()

PUBLIC_ROLES = {UserRole.DONOR, UserRole.RECIPIENT, UserRole.VOLUNTEER, UserRole.CORPORATE}

login_failures = SlidingWindowLimiter(settings.LOGIN_MAX_FAILURES, settings.LOGIN_WINDOW_SECONDS)
register_limiter = SlidingWindowLimiter(10, 3600)
email_limiter = SlidingWindowLimiter(5, 3600)

VERIFY_TTL = timedelta(hours=48)
RESET_TTL = timedelta(minutes=30)


async def _issue_token(db: AsyncSession, user: User, purpose: str, ttl: timedelta) -> str:
    raw, digest = generate_token()
    db.add(
        AuthToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            purpose=purpose,
            token_hash=digest,
            expires_at=datetime.utcnow() + ttl,
        )
    )
    return raw


async def _consume_token(db: AsyncSession, raw: str, purpose: str) -> User:
    res = await db.execute(
        select(AuthToken).filter(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose)
    )
    tok = res.scalars().first()
    if not tok or tok.used_at is not None or tok.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link is invalid or has expired. Request a new one.",
        )
    tok.used_at = datetime.utcnow()
    user_res = await db.execute(select(User).filter(User.id == tok.user_id))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found.")
    return user


async def _send_verification(db: AsyncSession, user: User) -> None:
    raw = await _issue_token(db, user, "verify_email", VERIFY_TTL)
    await db.commit()
    link = f"{settings.FRONTEND_URL}/verify-email?token={raw}"
    await send_email(
        user.email,
        "Confirm your FoodRescue email address",
        f"Hello {user.full_name},\n\nConfirm your email address to finish setting up your "
        f"FoodRescue account:\n\n{link}\n\nThis link expires in 48 hours. If you did not create "
        "an account, you can ignore this message.\n",
    )


# ---------------------------------------------------------------------------
# Registration and sign-in
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    if user_in.role in [UserRole.ADMIN, UserRole.OPS_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration for administrator roles is prohibited.",
        )
    if user_in.role not in PUBLIC_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported account type.")

    register_limiter.check_and_hit(
        f"register:{client_ip(request)}",
        "Too many sign-up attempts from this network. Try again later.",
    )

    if not user_in.accept_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms of Service and Privacy Policy to create an account.",
        )

    problems = password_problems(user_in.password)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain " + ", ".join(problems) + ".",
        )

    email = user_in.email.lower()
    result = await db.execute(select(User).filter(User.email == email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists.",
        )
    if user_in.phone:
        phone_res = await db.execute(select(User).filter(User.phone == user_in.phone))
        if phone_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this phone number already exists.",
            )

    new_user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        phone=user_in.phone,
        is_active=True,
        terms_accepted_at=datetime.utcnow(),
        profile={"organization_name": user_in.organization_name} if user_in.organization_name else {},
    )
    db.add(new_user)
    await db.flush()  # the user row must exist before rows that reference it
    db.add(
        AuditLog(
            id=str(uuid.uuid4()),
            actor_id=new_user.id,
            action="REGISTER_USER",
            resource="users",
            after_value={"id": new_user.id, "role": user_in.role.value},
            ip_address=client_ip(request),
        )
    )
    await db.commit()
    await db.refresh(new_user)
    await _send_verification(db, new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember: bool = Form(False),
    db: AsyncSession = Depends(get_db),
):
    email = form_data.username.strip().lower()
    key = f"login:{client_ip(request)}:{email}"
    wait = login_failures.retry_after(key)
    if wait:
        minutes = max(1, wait // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed sign-in attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
            headers={"Retry-After": str(wait)},
        )

    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        login_failures.hit(key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    login_failures.reset(key)
    lifetime = (
        timedelta(days=settings.REMEMBER_ME_EXPIRE_DAYS)
        if remember
        else timedelta(minutes=settings.SESSION_EXPIRE_MINUTES)
    )
    user.last_login_at = datetime.utcnow()
    await db.commit()
    access_token = create_access_token(subject=user.id, expires_delta=lifetime)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": int(lifetime.total_seconds()),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "onboarding_completed": bool(user.onboarding_completed),
    }


# ---------------------------------------------------------------------------
# Email verification and password reset
# ---------------------------------------------------------------------------

@router.post("/verify-email")
async def verify_email(body: TokenRequest, db: AsyncSession = Depends(get_db)):
    user = await _consume_token(db, body.token, "verify_email")
    user.email_verified = True
    await db.commit()
    return {"message": "Email address confirmed."}


@router.post("/resend-verification")
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        return {"message": "Your email address is already confirmed."}
    email_limiter.check_and_hit(
        f"verify:{current_user.id}", "Too many verification emails requested. Try again later."
    )
    await _send_verification(db, current_user)
    return {"message": "Verification email sent."}


@router.post("/forgot-password")
async def forgot_password(body: EmailRequest, request: Request, db: AsyncSession = Depends(get_db)):
    email_limiter.check_and_hit(
        f"reset:{client_ip(request)}", "Too many reset requests from this network. Try again later."
    )
    res = await db.execute(select(User).filter(User.email == body.email.lower()))
    user = res.scalars().first()
    if user and user.is_active:
        raw = await _issue_token(db, user, "reset_password", RESET_TTL)
        await db.commit()
        link = f"{settings.FRONTEND_URL}/reset-password?token={raw}"
        await send_email(
            user.email,
            "Reset your FoodRescue password",
            f"Hello {user.full_name},\n\nUse this link to choose a new password:\n\n{link}\n\n"
            "The link expires in 30 minutes and can be used once. If you did not ask to reset "
            "your password, ignore this message.\n",
        )
    # Same response whether or not the account exists, to avoid account enumeration.
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: PasswordReset, db: AsyncSession = Depends(get_db)):
    problems = password_problems(body.password)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain " + ", ".join(problems) + ".",
        )
    user = await _consume_token(db, body.token, "reset_password")
    user.hashed_password = hash_password(body.password)
    db.add(
        AuditLog(
            id=str(uuid.uuid4()), actor_id=user.id, action="RESET_PASSWORD", resource="users",
            after_value={"id": user.id},
        )
    )
    await db.commit()
    return {"message": "Password updated. You can now sign in."}


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

async def _build_me(db: AsyncSession, user: User) -> MeResponse:
    org = await get_user_organization(db, user)
    vol_res = await db.execute(select(Volunteer).filter(Volunteer.user_id == user.id))
    vol = vol_res.scalars().first()
    data = MeResponse.model_validate(user, from_attributes=True)
    data.profile = user.profile or {}
    data.phone_verification_available = bool(settings.SMS_PROVIDER)
    if org:
        data.organization = OrganizationSummary(
            id=org.id,
            name=org.name,
            type=org.type.value,
            verification_status=org.verification_status.value,
            verification_notes=org.verification_notes,
            address=org.address,
            latitude=org.latitude,
            longitude=org.longitude,
            daily_capacity=org.daily_capacity,
            fssai_number=org.fssai_number,
            ngo_darpan_id=org.ngo_darpan_id,
            profile=org.profile or {},
        )
    if vol:
        data.volunteer = VolunteerSummary(
            id=vol.id,
            vehicle_type=vol.vehicle_type,
            vehicle_capacity=vol.vehicle_capacity,
            service_area=vol.service_area,
            availability=vol.availability or {},
            is_available=bool(vol.is_available),
            latitude=vol.latitude,
            longitude=vol.longitude,
        )
    return data


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_me(db, current_user)


@router.patch("/me", response_model=MeResponse)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        current_user.full_name = " ".join(body.full_name.split())
    if body.phone is not None and body.phone != current_user.phone:
        current_user.phone = body.phone
        current_user.phone_verified = False
    await db.commit()
    await db.refresh(current_user)
    return await _build_me(db, current_user)


@router.post("/change-password")
async def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    problems = password_problems(new_password)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain " + ", ".join(problems) + ".",
        )
    current_user.hashed_password = hash_password(new_password)
    await db.commit()
    return {"message": "Password updated."}


# ---------------------------------------------------------------------------
# Role-specific onboarding
# ---------------------------------------------------------------------------

ROLE_TO_ORG = {
    UserRole.DONOR: OrgType.DONOR,
    UserRole.RECIPIENT: OrgType.RECIPIENT,
    UserRole.CORPORATE: OrgType.CORPORATE,
}


async def _upsert_org(
    db: AsyncSession,
    user: User,
    *,
    name: str,
    address: str,
    latitude: float,
    longitude: float,
    profile: dict,
    fssai_number: Optional[str] = None,
    ngo_darpan_id: Optional[str] = None,
    daily_capacity: Optional[float] = None,
) -> Organization:
    org = await get_user_organization(db, user)
    if org is None:
        org = Organization(
            id=str(uuid.uuid4()),
            type=ROLE_TO_ORG[user.role],
            verification_status=VerificationStatus.PENDING,
            is_demo=False,
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
        )
        db.add(org)
        await db.flush()
        db.add(Membership(id=str(uuid.uuid4()), user_id=user.id, organization_id=org.id, role=OrgRole.ADMIN))
    else:
        org.name = name
        org.address = address
        org.latitude = latitude
        org.longitude = longitude
        # Resubmitting after a request for more information puts the case back in the queue.
        if org.verification_status in (VerificationStatus.INFO_REQUIRED, VerificationStatus.REJECTED):
            org.verification_status = VerificationStatus.PENDING
    org.profile = profile
    org.fssai_number = fssai_number
    org.ngo_darpan_id = ngo_darpan_id
    org.daily_capacity = daily_capacity
    return org


@router.post("/onboarding", response_model=MeResponse)
async def complete_onboarding(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await _apply_onboarding(db, current_user, payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()],
        )


async def _apply_onboarding(db: AsyncSession, current_user: User, payload: dict) -> MeResponse:
    role = current_user.role
    if role == UserRole.DONOR:
        data = DonorOnboarding(**payload)
        await _upsert_org(
            db, current_user,
            name=data.business_name,
            address=data.location.address,
            latitude=data.location.latitude,
            longitude=data.location.longitude,
            fssai_number=data.fssai_number,
            profile={
                "business_category": data.business_category,
                "city": data.location.city,
                "contact_name": data.contact_name,
                "contact_phone": data.contact_phone,
                "operating_hours": data.operating_hours,
                "food_categories": data.food_categories,
                "branches": [],
            },
        )
    elif role == UserRole.RECIPIENT:
        data = NgoOnboarding(**payload)
        await _upsert_org(
            db, current_user,
            name=data.organization_name,
            address=data.location.address,
            latitude=data.location.latitude,
            longitude=data.location.longitude,
            fssai_number=data.fssai_number,
            ngo_darpan_id=data.registration_number,
            daily_capacity=float(data.daily_meal_capacity),
            profile={
                "city": data.location.city,
                "operating_locations": data.operating_locations,
                "contact_name": data.contact_name,
                "contact_phone": data.contact_phone,
                "food_categories": data.food_categories,
            },
        )
    elif role == UserRole.CORPORATE:
        data = CorporateOnboarding(**payload)
        await _upsert_org(
            db, current_user,
            name=data.company_name,
            address=data.location.address,
            latitude=data.location.latitude,
            longitude=data.location.longitude,
            profile={
                "industry": data.industry,
                "cin_or_gstin": data.cin_or_gstin,
                "city": data.location.city,
                "representative_name": data.representative_name,
                "representative_designation": data.representative_designation,
                "contact_email": data.contact_email,
                "contact_phone": data.contact_phone,
                "branches": [b.model_dump() for b in data.branches],
            },
        )
    elif role == UserRole.VOLUNTEER:
        data = VolunteerOnboarding(**payload)
        res = await db.execute(select(Volunteer).filter(Volunteer.user_id == current_user.id))
        vol = res.scalars().first()
        if vol is None:
            vol = Volunteer(id=str(uuid.uuid4()), user_id=current_user.id)
            db.add(vol)
        vol.vehicle_type = data.vehicle_type
        vol.vehicle_capacity = data.vehicle_capacity_kg or 0.0
        vol.service_area = data.service_area
        vol.latitude = data.latitude
        vol.longitude = data.longitude
        vol.availability = {
            "days": data.available_days,
            "from": data.available_from,
            "to": data.available_to,
        }
        vol.is_available = True
        if not current_user.phone:
            current_user.phone = data.contact_phone
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account type has no onboarding.")

    current_user.onboarding_completed = True
    db.add(
        AuditLog(
            id=str(uuid.uuid4()), actor_id=current_user.id, action="COMPLETE_ONBOARDING",
            resource="users", after_value={"role": role.value},
        )
    )
    await db.commit()
    await db.refresh(current_user)
    return await _build_me(db, current_user)
