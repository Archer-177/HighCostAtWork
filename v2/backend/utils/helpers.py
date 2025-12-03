"""
Utility functions for common operations
"""
import uuid
import socket
import logging
from datetime import datetime, timedelta, date
from typing import Optional, Tuple
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import pytz

# Adelaide timezone
ADELAIDE_TZ = pytz.timezone('Australia/Adelaide')

# Expiry thresholds (days)
CRITICAL_THRESHOLD = 30
WARNING_THRESHOLD = 90

# Initialize password hasher (Argon2 - more secure than PBKDF2)
ph = PasswordHasher()


# ============================================================================
# PASSWORD UTILITIES
# ============================================================================
def hash_password(password: str) -> str:
    """Hash password using Argon2"""
    return ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify password against hash"""
    try:
        ph.verify(password_hash, password)

        # Check if rehashing is needed (Argon2 params changed)
        if ph.check_needs_rehash(password_hash):
            return True  # Signal that password should be rehashed

        return True
    except VerifyMismatchError:
        return False


# ============================================================================
# ASSET ID GENERATION
# ============================================================================
def generate_asset_id(drug_name: str, location_code: str, timestamp: Optional[int] = None) -> str:
    """
    Generate unique asset ID
    Format: DRUG-LOC-TIMESTAMP-UUID
    Example: TEN-PA-1701234567-A1B2
    """
    if timestamp is None:
        timestamp = int(datetime.now(ADELAIDE_TZ).timestamp())

    # Drug code: First 3 letters uppercase
    drug_code = ''.join(c for c in drug_name if c.isalnum())[:3].upper()

    # Location code: Max 5 chars
    loc_code = ''.join(c for c in location_code if c.isalnum())[:5].upper()

    # Unique suffix: First 4 chars of UUID
    unique_suffix = str(uuid.uuid4())[:4].upper()

    return f"{drug_code}-{loc_code}-{timestamp}-{unique_suffix}"


# ============================================================================
# DATE/TIME UTILITIES
# ============================================================================
def get_adelaide_now() -> datetime:
    """Get current datetime in Adelaide timezone"""
    return datetime.now(ADELAIDE_TZ)


def get_adelaide_date() -> date:
    """Get current date in Adelaide"""
    return get_adelaide_now().date()


def days_until_expiry(expiry_date: date) -> int:
    """Calculate days until expiry from today"""
    today = get_adelaide_date()
    delta = expiry_date - today
    return delta.days


def get_status_color(expiry_date: date) -> str:
    """Determine status color based on expiry date"""
    days = days_until_expiry(expiry_date)

    if days <= CRITICAL_THRESHOLD:
        return 'red'
    elif days <= WARNING_THRESHOLD:
        return 'amber'
    else:
        return 'green'


# ============================================================================
# NETWORK UTILITIES
# ============================================================================
def find_available_port(start_port: int = 5000, end_port: int = 5100) -> int:
    """Find first available port in range"""
    for port in range(start_port, end_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port

    raise RuntimeError(f"No available ports found in range {start_port}-{end_port}")


def is_port_in_use(port: int) -> bool:
    """Check if port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


# ============================================================================
# VALIDATION UTILITIES
# ============================================================================
def validate_mrn(mrn: str) -> bool:
    """Validate Medical Record Number format"""
    # Basic validation: alphanumeric, 4-20 characters
    if not mrn or not (4 <= len(mrn) <= 20):
        return False
    return mrn.replace('-', '').replace('_', '').isalnum()


def validate_batch_number(batch: str) -> bool:
    """Validate batch number format"""
    if not batch or len(batch) < 3 or len(batch) > 100:
        return False
    return True


def validate_australian_mobile(mobile: str) -> Tuple[bool, Optional[str]]:
    """
    Validate and format Australian mobile number
    Returns: (is_valid, formatted_number)
    """
    # Remove all non-digits
    digits = ''.join(c for c in mobile if c.isdigit())

    # Australian mobile: 04XX XXX XXX (10 digits starting with 04)
    if len(digits) == 10 and digits.startswith('04'):
        # Format as +61 4XX XXX XXX
        formatted = f"+61 {digits[1:4]} {digits[4:7]} {digits[7:]}"
        return True, formatted

    # Already in international format
    if len(digits) == 11 and digits.startswith('614'):
        formatted = f"+{digits[0:2]} {digits[2:5]} {digits[5:8]} {digits[8:]}"
        return True, formatted

    return False, None


# ============================================================================
# BUSINESS LOGIC UTILITIES
# ============================================================================
def determine_transfer_status(from_type: str, to_type: str, from_hub_id: int, to_hub_id: int) -> str:
    """
    Determine initial transfer status based on location types

    Rules:
    - Hub -> Own Ward: COMPLETED (immediate)
    - Hub -> Hub (different): PENDING (needs approval)
    - Hub -> Remote: IN_TRANSIT
    - Ward -> Ward (same hub): COMPLETED (immediate)
    - Other: IN_TRANSIT
    """
    # Hub to its own ward - immediate
    if from_type == 'HUB' and to_type == 'WARD' and from_hub_id == to_hub_id:
        return 'COMPLETED'

    # Hub to different hub - needs approval
    if from_type == 'HUB' and to_type == 'HUB' and from_hub_id != to_hub_id:
        return 'PENDING'

    # All other transfers go to IN_TRANSIT
    return 'IN_TRANSIT'


def requires_approval(from_type: str, to_type: str, from_hub_id: int, to_hub_id: int) -> bool:
    """Check if transfer requires approval"""
    return (
        from_type == 'HUB' and
        to_type == 'HUB' and
        from_hub_id != to_hub_id
    )


def can_user_approve_transfer(
    user_location_id: int,
    user_role: str,
    user_can_delegate: bool,
    creator_location_id: int,
    from_location_id: int,
    to_location_id: int
) -> Tuple[bool, Optional[str]]:
    """
    Check if user can approve a transfer

    Rules:
    - Must be PHARMACIST with can_delegate
    - Must be from the "other hub" (not the creator's hub)
    - Cannot approve own transfer

    Returns: (can_approve, error_message)
    """
    # Must be pharmacist with delegation rights
    if user_role != 'PHARMACIST' or not user_can_delegate:
        return False, "Only pharmacists with delegation rights can approve transfers"

    # Determine which hub needs to approve
    if creator_location_id == from_location_id:
        # Creator is at source - destination hub must approve (PUSH)
        required_location = to_location_id
    elif creator_location_id == to_location_id:
        # Creator is at destination - source hub must approve (PULL)
        required_location = from_location_id
    else:
        # Creator is elsewhere - default to destination
        required_location = to_location_id

    # Check if approver is at required location
    if user_location_id != required_location:
        return False, "Only pharmacists from the other hub can approve this transfer"

    return True, None


# ============================================================================
# LOGGING UTILITIES
# ============================================================================
def setup_logger(name: str, log_file: Optional[str] = None, level=logging.INFO) -> logging.Logger:
    """Set up logger with consistent formatting"""
    logger = logging.getLogger(name)
    logger.setLevel(level)

    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler (if specified)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# ============================================================================
# SANITIZATION UTILITIES
# ============================================================================
def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    # Remove path separators and dangerous characters
    dangerous_chars = ['/', '\\', '..', '<', '>', ':', '"', '|', '?', '*']
    clean = filename
    for char in dangerous_chars:
        clean = clean.replace(char, '_')

    # Limit length
    return clean[:255]


def sanitize_search_term(term: str) -> str:
    """Sanitize user search input"""
    # Remove SQL wildcards that could cause issues
    return term.replace('%', '').replace('_', '').strip()


# ============================================================================
# STOCK CALCULATION UTILITIES
# ============================================================================
def calculate_stock_by_location(vials: list) -> dict:
    """
    Group vials by location and calculate counts
    Returns: {location_id: {total: int, by_status: {...}}}
    """
    result = {}

    for vial in vials:
        loc_id = vial.location_id
        if loc_id not in result:
            result[loc_id] = {
                'total': 0,
                'by_status': {}
            }

        result[loc_id]['total'] += 1
        status = vial.status
        result[loc_id]['by_status'][status] = result[loc_id]['by_status'].get(status, 0) + 1

    return result


def calculate_stock_value(vials: list) -> float:
    """Calculate total value of vials"""
    return sum(vial.drug.unit_price for vial in vials if hasattr(vial, 'drug'))


# ============================================================================
# ZPL LABEL GENERATION
# ============================================================================
def generate_zpl_label(
    asset_id: str,
    drug_name: str,
    expiry_date: str,
    storage_temp: str,
    x_offset: int = 20,
    y_offset: int = 0
) -> str:
    """
    Generate ZPL code for Zebra label printer

    Args:
        asset_id: Asset ID (encoded in QR code)
        drug_name: Drug name (max 20 chars for label)
        expiry_date: Expiry date string
        storage_temp: Storage temperature
        x_offset: X position offset in dots
        y_offset: Y position offset in dots

    Returns:
        ZPL command string
    """
    # Truncate drug name if too long
    drug_display = drug_name[:20]

    zpl = f"""^XA
^CI28
^LH{x_offset},{y_offset}
^FO0,20^BQN,2,4^FDQA,{asset_id}^FS
^FO120,20^A0N,30,30^FD{drug_display}^FS
^FO120,55^A0N,25,25^FDExp: {expiry_date}^FS
^FO120,85^A0N,25,25^FD{asset_id}^FS
^FO120,115^A0N,20,20^FD{storage_temp}^FS
^XZ
"""
    return zpl


def send_to_printer(zpl_code: str, printer_ip: str, printer_port: int = 9100) -> Tuple[bool, Optional[str]]:
    """
    Send ZPL code to network printer

    Returns: (success, error_message)
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((printer_ip, printer_port))
            s.sendall(zpl_code.encode('utf-8'))
        return True, None
    except socket.timeout:
        return False, "Printer connection timeout"
    except ConnectionRefusedError:
        return False, "Printer refused connection"
    except Exception as e:
        return False, f"Printer error: {str(e)}"
