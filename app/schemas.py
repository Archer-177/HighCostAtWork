from pydantic import BaseModel, EmailStr
from typing import Optional, List

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str
    location_id: int
    can_delegate: Optional[bool] = False
    is_supervisor: Optional[bool] = False
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None

class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    location_id: Optional[int] = None
    can_delegate: Optional[bool] = None
    is_supervisor: Optional[bool] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    password: Optional[str] = None
    version: int

class ChangePasswordRequest(BaseModel):
    username: str
    oldPassword: str
    newPassword: str

class ForgotPasswordRequest(BaseModel):
    username: str

class ResetPasswordRequest(BaseModel):
    username: str
    code: str
    newPassword: str

class ReceiveStockRequest(BaseModel):
    drug_id: int
    batch_number: str
    expiry_date: str
    quantity: int
    location_id: int
    user_id: int
    goods_receipt_number: Optional[str] = None

class UseStockRequest(BaseModel):
    vial_id: int
    user_id: int
    action: str
    discard_reason: Optional[str] = None
    version: int
    patient_mrn: Optional[str] = None
    clinical_notes: Optional[str] = None

class CreateTransferRequest(BaseModel):
    from_location_id: int
    to_location_id: int
    vial_ids: List[int]
    created_by: int

class TransferActionRequest(BaseModel):
    user_id: int
    version: int

class SettingsRequest(BaseModel):
    printer_ip: Optional[str] = None
    printer_port: Optional[str] = None
    label_width: Optional[int] = 50
    label_height: Optional[int] = 25
    margin_top: Optional[int] = 0
    margin_right: Optional[int] = 0
    location_id: int

class CreateLocationRequest(BaseModel):
    name: str
    type: str
    parent_hub_id: Optional[int] = None

class UpdateLocationRequest(BaseModel):
    name: str
    type: str
    parent_hub_id: Optional[int] = None
    version: int

class CreateDrugRequest(BaseModel):
    name: str
    category: str
    storage_temp: str
    unit_price: float

class UpdateStockLevelsRequest(BaseModel):
    updates: List[dict]