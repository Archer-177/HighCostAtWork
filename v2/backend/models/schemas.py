"""
Pydantic schemas for request/response validation
Type-safe API contracts
"""
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, date
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================
class LocationType(str, Enum):
    HUB = 'HUB'
    WARD = 'WARD'
    REMOTE = 'REMOTE'


class UserRole(str, Enum):
    PHARMACIST = 'PHARMACIST'
    PHARMACY_TECH = 'PHARMACY_TECH'
    NURSE = 'NURSE'


class VialStatus(str, Enum):
    AVAILABLE = 'AVAILABLE'
    USED_CLINICAL = 'USED_CLINICAL'
    DISCARDED = 'DISCARDED'
    IN_TRANSIT = 'IN_TRANSIT'


class TransferStatus(str, Enum):
    PENDING = 'PENDING'
    IN_TRANSIT = 'IN_TRANSIT'
    COMPLETED = 'COMPLETED'
    CANCELLED = 'CANCELLED'


class DiscardReason(str, Enum):
    EXPIRED = 'Expired'
    BROKEN_DAMAGED = 'Broken/Damaged'
    FRIDGE_FAILURE = 'Fridge Failure'
    LOST = 'Lost'
    OTHER = 'Other'


# ============================================================================
# BASE SCHEMAS
# ============================================================================
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# LOCATION SCHEMAS
# ============================================================================
class LocationBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=100)
    type: LocationType
    parent_hub_id: Optional[int] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[LocationType] = None
    parent_hub_id: Optional[int] = None
    is_active: Optional[bool] = None


class LocationResponse(LocationBase):
    id: int
    is_active: bool
    created_at: datetime
    version: int


# ============================================================================
# USER SCHEMAS
# ============================================================================
class UserBase(BaseSchema):
    username: str = Field(..., min_length=3, max_length=50)
    role: UserRole
    location_id: int
    email: Optional[str] = Field(None, max_length=100)
    mobile_number: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    can_delegate: bool = False
    is_supervisor: bool = False


class UserUpdate(BaseSchema):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    role: Optional[UserRole] = None
    location_id: Optional[int] = None
    email: Optional[str] = Field(None, max_length=100)
    mobile_number: Optional[str] = Field(None, max_length=20)
    can_delegate: Optional[bool] = None
    is_supervisor: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    can_delegate: bool
    is_supervisor: bool
    is_active: bool
    must_change_password: bool
    created_at: datetime
    last_login: Optional[datetime]
    version: int


class UserLogin(BaseSchema):
    username: str
    password: str


class PasswordChange(BaseSchema):
    username: str
    old_password: str
    new_password: str = Field(..., min_length=8)


class PasswordReset(BaseSchema):
    username: str
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


# ============================================================================
# DRUG SCHEMAS
# ============================================================================
class DrugBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    storage_temp: Optional[str] = Field(None, max_length=50)
    unit_price: float = Field(..., gt=0)


class DrugCreate(DrugBase):
    pass


class DrugUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    storage_temp: Optional[str] = Field(None, max_length=50)
    unit_price: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None


class DrugResponse(DrugBase):
    id: int
    is_active: bool
    created_at: datetime
    version: int


# ============================================================================
# STOCK LEVEL SCHEMAS
# ============================================================================
class StockLevelBase(BaseSchema):
    location_id: int
    drug_id: int
    min_stock: int = Field(..., ge=0)


class StockLevelCreate(StockLevelBase):
    pass


class StockLevelUpdate(BaseSchema):
    min_stock: int = Field(..., ge=0)


class StockLevelResponse(StockLevelBase):
    id: int
    version: int


# ============================================================================
# VIAL SCHEMAS
# ============================================================================
class VialBase(BaseSchema):
    drug_id: int
    batch_number: str = Field(..., min_length=1, max_length=100)
    expiry_date: date
    location_id: int


class VialCreate(VialBase):
    quantity: int = Field(..., gt=0, le=1000)
    goods_receipt_number: str = Field(..., min_length=1, max_length=100)


class VialUpdate(BaseSchema):
    location_id: Optional[int] = None
    status: Optional[VialStatus] = None


class VialUse(BaseSchema):
    vial_id: int
    user_id: int
    version: int
    patient_mrn: str = Field(..., min_length=1, max_length=50)
    clinical_notes: Optional[str] = None


class VialDiscard(BaseSchema):
    vial_id: int
    user_id: int
    version: int
    discard_reason: DiscardReason
    disposal_register_number: str = Field(..., min_length=1, max_length=100)


class VialResponse(VialBase):
    id: int
    asset_id: str
    status: VialStatus
    goods_receipt_number: Optional[str]
    patient_mrn: Optional[str]
    clinical_notes: Optional[str]
    discard_reason: Optional[str]
    disposal_register_number: Optional[str]
    created_at: datetime
    used_at: Optional[datetime]
    used_by: Optional[int]
    version: int

    # Computed fields (populated by API)
    drug_name: Optional[str] = None
    category: Optional[str] = None
    storage_temp: Optional[str] = None
    unit_price: Optional[float] = None
    location_name: Optional[str] = None
    location_type: Optional[str] = None
    days_until_expiry: Optional[int] = None
    status_color: Optional[Literal['green', 'amber', 'red']] = None


# ============================================================================
# TRANSFER SCHEMAS
# ============================================================================
class TransferCreate(BaseSchema):
    from_location_id: int
    to_location_id: int
    vial_ids: List[int] = Field(..., min_length=1)
    created_by: int

    @field_validator('vial_ids')
    @classmethod
    def validate_vial_ids(cls, v):
        if len(v) == 0:
            raise ValueError('Must transfer at least one vial')
        if len(v) != len(set(v)):
            raise ValueError('Duplicate vial IDs not allowed')
        return v


class TransferAction(BaseSchema):
    user_id: int
    version: int


class TransferResponse(BaseSchema):
    id: int
    from_location_id: int
    to_location_id: int
    status: TransferStatus
    created_by: int
    approved_by: Optional[int]
    completed_by: Optional[int]
    created_at: datetime
    approved_at: Optional[datetime]
    completed_at: Optional[datetime]
    version: int

    # Populated by API
    from_location_name: Optional[str] = None
    to_location_name: Optional[str] = None
    creator_username: Optional[str] = None
    approver_username: Optional[str] = None
    completer_username: Optional[str] = None
    item_count: Optional[int] = None
    items: Optional[List[VialResponse]] = None


# ============================================================================
# DASHBOARD SCHEMAS
# ============================================================================
class DashboardStats(BaseSchema):
    total_stock: int
    healthy_stock: int
    warning_stock: int
    expiring_soon: int
    total_value: float


class DashboardResponse(BaseSchema):
    user: UserResponse
    stock: List[VialResponse]
    stats: DashboardStats


# ============================================================================
# SEARCH SCHEMAS
# ============================================================================
class StockSearchRequest(BaseSchema):
    query: Optional[str] = None
    status: Optional[VialStatus] = None
    location_id: Optional[int] = None
    drug_id: Optional[int] = None
    expiry_before: Optional[date] = None
    expiry_after: Optional[date] = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)


# ============================================================================
# REPORT SCHEMAS
# ============================================================================
class UsageReportRequest(BaseSchema):
    start_date: date
    end_date: date
    location_id: Optional[int] = None


class UsageReportRow(BaseSchema):
    drug_name: str
    location_name: str
    clinical_use: int
    wastage: int
    clinical_value: float
    wastage_value: float


class UsageReportResponse(BaseSchema):
    start_date: date
    end_date: date
    data: List[UsageReportRow]
    total_clinical_value: float
    total_wastage_value: float


# ============================================================================
# STOCK JOURNEY SCHEMAS
# ============================================================================
class JourneyEvent(BaseSchema):
    type: str
    timestamp: datetime
    title: str
    location: str
    user: str
    details: dict


class StockJourneyResponse(BaseSchema):
    vial: VialResponse
    timeline: List[JourneyEvent]


# ============================================================================
# SETTINGS SCHEMAS
# ============================================================================
class SettingsUpdate(BaseSchema):
    printer_ip: Optional[str] = Field(None, max_length=45)
    printer_port: Optional[int] = Field(None, ge=1, le=65535)
    label_width: Optional[int] = Field(None, ge=10, le=200)
    label_height: Optional[int] = Field(None, ge=10, le=200)
    margin_top: Optional[int] = Field(None, ge=0, le=100)
    margin_right: Optional[int] = Field(None, ge=0, le=100)
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None


class SettingsResponse(SettingsUpdate):
    id: int
    location_id: int
    updated_at: datetime


# ============================================================================
# GENERIC RESPONSE SCHEMAS
# ============================================================================
class SuccessResponse(BaseSchema):
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict] = None


class ErrorResponse(BaseSchema):
    success: bool = False
    error: str
    details: Optional[dict] = None


class BulkOperationResponse(BaseSchema):
    success: bool
    processed: int
    failed: int
    errors: List[dict] = []
