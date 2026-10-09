import enum

from datetime import datetime

from typing import Optional, List

from sqlalchemy import (

    Column,

    String,

    Integer,

    Float,

    Boolean,

    DateTime,

    ForeignKey,

    Enum,

    JSON,

    Table,

)

from sqlalchemy.orm import relationship

from app.db.session import Base

# Role definitions

class UserRole(str, enum.Enum):

    DONOR = "DONOR"

    RECIPIENT = "RECIPIENT"

    VOLUNTEER = "VOLUNTEER"

    OPS_MANAGER = "OPS_MANAGER"

    ADMIN = "ADMIN"

class OrgRole(str, enum.Enum):

    ADMIN = "ADMIN"

    MEMBER = "MEMBER"

class OrgType(str, enum.Enum):

    DONOR = "DONOR"

    RECIPIENT = "RECIPIENT"

class VerificationStatus(str, enum.Enum):

    PENDING = "PENDING"

    UNDER_REVIEW = "UNDER_REVIEW"

    VERIFIED = "VERIFIED"

    REJECTED = "REJECTED"

    SUSPENDED = "SUSPENDED"

class DonationStatus(str, enum.Enum):

    DRAFT = "DRAFT"

    PUBLISHED = "PUBLISHED"

    MATCHING = "MATCHING"

    CLAIMED = "CLAIMED"

    PICKUP_ASSIGNED = "PICKUP_ASSIGNED"

    PICKED_UP = "PICKED_UP"

    DELIVERED = "DELIVERED"

    COMPLETED = "COMPLETED"

    CANCELLED = "CANCELLED"

    EXPIRED = "EXPIRED"

    DISPUTED = "DISPUTED"

    FAILED = "FAILED"

class CustodyEventType(str, enum.Enum):

    HANDOFF = "HANDOFF"

    PICKUP = "PICKUP"

    DELIVERY = "DELIVERY"

class User(Base):

    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)

    hashed_password = Column(String, nullable=False)

    full_name = Column(String, nullable=False)

    role = Column(

        Enum(UserRole, native_enum=False),

        nullable=False,

        default=UserRole.DONOR,

    )

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(

        DateTime,

        default=datetime.utcnow,

        onupdate=datetime.utcnow,

    )

    # Relationships

    memberships = relationship(

        "Membership",

        back_populates="user",

        cascade="all, delete-orphan",

    )

    notifications = relationship(

        "Notification",

        back_populates="user",

        cascade="all, delete-orphan",

    )

    volunteer_profile = relationship(

        "Volunteer",

        back_populates="user",

        uselist=False,

        cascade="all, delete-orphan",

    )

class Organization(Base):

    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)

    name = Column(String, nullable=False)

    type = Column(

        Enum(OrgType, native_enum=False),

        nullable=False,

    )

    verification_status = Column(

        Enum(VerificationStatus, native_enum=False),

        default=VerificationStatus.PENDING,

    )

    fssai_number = Column(String, nullable=True)

    ngo_darpan_id = Column(String, nullable=True)

    address = Column(String, nullable=False)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    is_demo = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(

        DateTime,

        default=datetime.utcnow,

        onupdate=datetime.utcnow,

    )

    # Relationships

    memberships = relationship(

        "Membership",

        back_populates="organization",

        cascade="all, delete-orphan",

    )

    documents = relationship(

        "OrganizationDocument",

        back_populates="organization",

        cascade="all, delete-orphan",

    )

    donations = relationship(

        "Donation",

        back_populates="organization",

        cascade="all, delete-orphan",

    )

    demands = relationship(

        "Demand",

        back_populates="organization",

        cascade="all, delete-orphan",

    )

class Membership(Base):

    __tablename__ = "memberships"

    id = Column(String, primary_key=True, index=True)

    user_id = Column(

        String,

        ForeignKey("users.id", ondelete="CASCADE"),

        nullable=False,

    )

    organization_id = Column(

        String,

        ForeignKey("organizations.id", ondelete="CASCADE"),

        nullable=False,

    )

    role = Column(

        Enum(OrgRole, native_enum=False),

        default=OrgRole.MEMBER,

        nullable=False,

    )

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="memberships")

    organization = relationship(

        "Organization",

        back_populates="memberships",

    )

class OrganizationDocument(Base):

    __tablename__ = "organization_documents"

    id = Column(String, primary_key=True, index=True)

    organization_id = Column(

        String,

        ForeignKey("organizations.id", ondelete="CASCADE"),

        nullable=False,

    )

    file_path = Column(String, nullable=False)

    document_type = Column(

        String,

        nullable=False,

    )  # "fssai_license", "ngo_registration", "pan"

    status = Column(

        Enum(VerificationStatus, native_enum=False),

        default=VerificationStatus.PENDING,

    )

    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship(
        "Organization",
        back_populates="documents",
    )

class Jurisdiction(Base):

    __tablename__ = "jurisdictions"

    id = Column(String, primary_key=True, index=True)

    code = Column(

        String,

        unique=True,

        index=True,

        nullable=False,

    )  # e.g. "ANDHRA_PRADESH"

    name = Column(String, nullable=False)

    languages = Column(JSON, default=list)  # e.g. ["en", "te"]

    rules = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)

class Donation(Base):

    __tablename__ = "donations"

    id = Column(String, primary_key=True, index=True)

    organization_id = Column(

        String,

        ForeignKey("organizations.id", ondelete="CASCADE"),

        nullable=False,

    )

    creator_id = Column(

        String,

        ForeignKey("users.id"),

        nullable=False,

    )

    title = Column(String, nullable=False)

    description = Column(String, nullable=True)

    status = Column(

        Enum(DonationStatus, native_enum=False),

        default=DonationStatus.DRAFT,

        nullable=False,

    )

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    pickup_address = Column(String, nullable=False)

    pickup_deadline = Column(DateTime, nullable=False)

    storage_info = Column(String, nullable=True)

    is_demo = Column(Boolean, default=False)

    state_history = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(

        DateTime,

        default=datetime.utcnow,

        onupdate=datetime.utcnow,

    )

    # Relationships

    organization = relationship(

        "Organization",

        back_populates="donations",

    )

    food_items = relationship(

        "FoodItem",

        back_populates="donation",

        cascade="all, delete-orphan",

    )

    matches = relationship(

        "Match",

        back_populates="donation",

        cascade="all, delete-orphan",

    )

    pickup_tasks = relationship(

        "PickupTask",

        back_populates="donation",

        cascade="all, delete-orphan",

    )

class FoodItem(Base):

    __tablename__ = "food_items"

    id = Column(String, primary_key=True, index=True)

    donation_id = Column(

        String,

        ForeignKey("donations.id", ondelete="CASCADE"),

        nullable=False,

    )

    name = Column(String, nullable=False)

    quantity = Column(Float, nullable=False)

    unit = Column(String, nullable=False)  # "kg", "meals", "boxes"

    is_veg = Column(Boolean, default=True, nullable=False)

    prep_time = Column(DateTime, nullable=False)

    expiry_time = Column(DateTime, nullable=False)

    is_leftover = Column(Boolean, default=False)

    donation = relationship("Donation", back_populates="food_items")

class Demand(Base):

    __tablename__ = "demands"

    id = Column(String, primary_key=True, index=True)

    organization_id = Column(

        String,

        ForeignKey("organizations.id", ondelete="CASCADE"),

        nullable=False,

    )

    food_category = Column(

        String,

        nullable=False,

    )  # "veg", "non-veg", "dry", "cooked"

    quantity_needed = Column(Float, nullable=False)

    unit = Column(String, nullable=False)

    priority = Column(String, default="medium")

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship(

        "Organization",

        back_populates="demands",

    )

class Match(Base):

    __tablename__ = "matches"

    id = Column(String, primary_key=True, index=True)

    donation_id = Column(

        String,

        ForeignKey("donations.id", ondelete="CASCADE"),

        nullable=False,

    )

    organization_id = Column(

        String,

        ForeignKey("organizations.id", ondelete="CASCADE"),

        nullable=False,

    )

    score = Column(Float, nullable=False)

    explanation = Column(JSON, default=dict)

    is_claimed = Column(Boolean, default=False)

    matching_config_version = Column(String, default="1.0.0")

    created_at = Column(DateTime, default=datetime.utcnow)

    donation = relationship("Donation", back_populates="matches")

    organization = relationship("Organization")

class Volunteer(Base):

    __tablename__ = "volunteers"

    id = Column(String, primary_key=True, index=True)

    user_id = Column(

        String,

        ForeignKey("users.id", ondelete="CASCADE"),

        nullable=False,

    )

    vehicle_type = Column(

        String,

        nullable=True,

    )  # "two-wheeler", "auto", "car", "truck"

    vehicle_capacity = Column(Float, default=0.0)

    is_available = Column(Boolean, default=True)

    latitude = Column(Float, nullable=True)

    longitude = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="volunteer_profile")

    pickup_tasks = relationship("PickupTask", back_populates="volunteer")

class PickupTask(Base):

    __tablename__ = "pickup_tasks"

    id = Column(String, primary_key=True, index=True)

    donation_id = Column(

        String,

        ForeignKey("donations.id", ondelete="CASCADE"),

        nullable=False,

    )

    volunteer_id = Column(

        String,

        ForeignKey("volunteers.id", ondelete="CASCADE"),

        nullable=True,

    )

    status = Column(String, default="ASSIGNED")

    # "ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED", "CANCELLED"

    qr_token = Column(

        String,

        unique=True,

        index=True,

        nullable=False,

    )

    created_at = Column(DateTime, default=datetime.utcnow)

    picked_up_at = Column(DateTime, nullable=True)

    delivered_at = Column(DateTime, nullable=True)

    donation = relationship("Donation", back_populates="pickup_tasks")

    volunteer = relationship("Volunteer", back_populates="pickup_tasks")

class CustodyEvent(Base):

    __tablename__ = "custody_events"

    id = Column(String, primary_key=True, index=True)

    donation_id = Column(

        String,

        ForeignKey("donations.id", ondelete="CASCADE"),

        nullable=False,

    )

    event_type = Column(

        Enum(CustodyEventType, native_enum=False),

        nullable=False,

    )

    actor_id = Column(

        String,

        ForeignKey("users.id"),

        nullable=False,

    )

    timestamp = Column(DateTime, default=datetime.utcnow)

    latitude = Column(Float, nullable=True)

    longitude = Column(Float, nullable=True)

    qr_token = Column(String, nullable=False)

    is_demo = Column(Boolean, default=False)

class Notification(Base):

    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)

    user_id = Column(

        String,

        ForeignKey("users.id", ondelete="CASCADE"),

        nullable=False,

    )

    type = Column(String, nullable=False)

    # "MATCH_FOUND", "PICKUP_ASSIGNED", "EXPIRED", etc.

    title = Column(String, nullable=False)

    message = Column(String, nullable=False)

    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class AuditLog(Base):

    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)

    actor_id = Column(

        String,

        ForeignKey("users.id", ondelete="SET NULL"),

        nullable=True,

    )

    action = Column(String, nullable=False)

    resource = Column(String, nullable=False)

    before_value = Column(JSON, nullable=True)

    after_value = Column(JSON, nullable=True)

    request_id = Column(String, nullable=True)

    ip_address = Column(String, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow)

class KnowledgeDocument(Base):

    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True, index=True)

    title = Column(String, nullable=False)

    content = Column(String, nullable=False)

    source_url = Column(String, nullable=True)

    jurisdiction = Column(

        String,

        default="ANDHRA_PRADESH",

    )

    language = Column(String, default="en")

    created_at = Column(DateTime, default=datetime.utcnow)

class KnowledgeChunk(Base):

    __tablename__ = "knowledge_chunks"

    id = Column(String, primary_key=True, index=True)

    document_id = Column(

        String,

        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),

        nullable=False,

    )

    chunk_index = Column(Integer, nullable=False)

    content = Column(String, nullable=False)

    embedding = Column(JSON, nullable=True)

    # Stores a list of floats; pgvector can be mapped here in the future.
