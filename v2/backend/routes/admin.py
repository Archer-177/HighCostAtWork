"""
Admin routes
CRUD operations for users, drugs, locations, stock levels, settings
"""
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import and_
from models.database import (
    get_session, User, Drug, Location, StockLevel, Settings
)
from models.schemas import (
    UserCreate, UserUpdate, DrugCreate, DrugUpdate,
    LocationCreate, LocationUpdate, StockLevelUpdate,
    SettingsUpdate
)
from utils.helpers import hash_password, get_adelaide_now

bp = Blueprint('admin', __name__)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def can_supervisor_manage_location(supervisor_location_id: int, target_location_id: int, session) -> bool:
    """
    Check if supervisor can manage a target location

    BUSINESS RULE: Supervisors can only manage their hub and hub children
    - If supervisor is at a HUB, they can manage that hub and all its children
    - If supervisor is at a WARD/REMOTE, they can only manage their own location

    Returns: True if allowed, False otherwise
    """
    supervisor_location = session.query(Location).filter_by(id=supervisor_location_id).first()
    target_location = session.query(Location).filter_by(id=target_location_id).first()

    if not supervisor_location or not target_location:
        return False

    # If supervisor is at a HUB
    if supervisor_location.type == 'HUB':
        # Can manage the hub itself
        if target_location_id == supervisor_location_id:
            return True

        # Can manage children of this hub
        if target_location.parent_hub_id == supervisor_location_id:
            return True

        return False

    # If supervisor is at WARD/REMOTE, can only manage their own location
    return target_location_id == supervisor_location_id


# ============================================================================
# USER MANAGEMENT
# ============================================================================
@bp.route('/users', methods=['GET'])
def get_users():
    """Get all active users"""
    session = get_session(current_app.engine)
    try:
        users = session.query(User).filter_by(is_active=True).all()
        result = []
        for user in users:
            result.append({
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'location_id': user.location_id,
                'location_name': user.location.name,
                'can_delegate': user.can_delegate,
                'is_supervisor': user.is_supervisor,
                'email': user.email,
                'mobile_number': user.mobile_number,
                'created_at': user.created_at.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None
            })
        return jsonify(result)
    finally:
        session.close()


@bp.route('/users', methods=['POST'])
def create_user():
    """Create new user"""
    try:
        data = UserCreate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        # Check if username exists
        existing = session.query(User).filter_by(username=data.username).first()
        if existing:
            return jsonify({'success': False, 'error': 'Username already exists'}), 409

        # Check if location exists
        location = session.query(Location).filter_by(id=data.location_id, is_active=True).first()
        if not location:
            return jsonify({'success': False, 'error': 'Invalid location'}), 400

        user = User(
            username=data.username,
            password_hash=hash_password(data.password),
            role=data.role,
            location_id=data.location_id,
            can_delegate=data.can_delegate,
            is_supervisor=data.is_supervisor,
            email=data.email,
            mobile_number=data.mobile_number,
            must_change_password=True,  # Force password change on first login
            created_at=get_adelaide_now()
        )
        session.add(user)
        session.commit()

        return jsonify({'success': True, 'id': user.id}), 201
    finally:
        session.close()


@bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user"""
    try:
        data = UserUpdate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        # Update fields if provided
        if data.username is not None:
            # Check uniqueness
            existing = session.query(User).filter(
                and_(User.username == data.username, User.id != user_id)
            ).first()
            if existing:
                return jsonify({'success': False, 'error': 'Username already exists'}), 409
            user.username = data.username

        if data.role is not None:
            user.role = data.role

        if data.location_id is not None:
            # Verify location exists
            location = session.query(Location).filter_by(id=data.location_id, is_active=True).first()
            if not location:
                return jsonify({'success': False, 'error': 'Invalid location'}), 400
            user.location_id = data.location_id

        if data.email is not None:
            user.email = data.email

        if data.mobile_number is not None:
            user.mobile_number = data.mobile_number

        if data.can_delegate is not None:
            user.can_delegate = data.can_delegate

        if data.is_supervisor is not None:
            user.is_supervisor = data.is_supervisor

        if data.password is not None:
            user.password_hash = hash_password(data.password)
            user.must_change_password = True

        if data.is_active is not None:
            user.is_active = data.is_active

        user.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Soft delete user"""
    session = get_session(current_app.engine)
    try:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        user.is_active = False
        user.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


# ============================================================================
# DRUG MANAGEMENT
# ============================================================================
@bp.route('/drugs', methods=['GET'])
def get_drugs():
    """Get all active drugs"""
    session = get_session(current_app.engine)
    try:
        drugs = session.query(Drug).filter_by(is_active=True).all()
        result = []
        for drug in drugs:
            result.append({
                'id': drug.id,
                'name': drug.name,
                'category': drug.category,
                'storage_temp': drug.storage_temp,
                'unit_price': drug.unit_price,
                'created_at': drug.created_at.isoformat()
            })
        return jsonify(result)
    finally:
        session.close()


@bp.route('/drugs', methods=['POST'])
def create_drug():
    """Create new drug"""
    try:
        data = DrugCreate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        # Check if drug name exists
        existing = session.query(Drug).filter_by(name=data.name).first()
        if existing:
            return jsonify({'success': False, 'error': 'Drug already exists'}), 409

        drug = Drug(
            name=data.name,
            category=data.category,
            storage_temp=data.storage_temp,
            unit_price=data.unit_price,
            created_at=get_adelaide_now()
        )
        session.add(drug)
        session.commit()

        return jsonify({'success': True, 'id': drug.id}), 201
    finally:
        session.close()


@bp.route('/drugs/<int:drug_id>', methods=['PUT'])
def update_drug(drug_id):
    """Update drug"""
    try:
        data = DrugUpdate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        drug = session.query(Drug).filter_by(id=drug_id).first()
        if not drug:
            return jsonify({'success': False, 'error': 'Drug not found'}), 404

        if data.name is not None:
            # Check uniqueness
            existing = session.query(Drug).filter(
                and_(Drug.name == data.name, Drug.id != drug_id)
            ).first()
            if existing:
                return jsonify({'success': False, 'error': 'Drug name already exists'}), 409
            drug.name = data.name

        if data.category is not None:
            drug.category = data.category

        if data.storage_temp is not None:
            drug.storage_temp = data.storage_temp

        if data.unit_price is not None:
            drug.unit_price = data.unit_price

        if data.is_active is not None:
            drug.is_active = data.is_active

        drug.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


@bp.route('/drugs/<int:drug_id>', methods=['DELETE'])
def delete_drug(drug_id):
    """Soft delete drug"""
    session = get_session(current_app.engine)
    try:
        drug = session.query(Drug).filter_by(id=drug_id).first()
        if not drug:
            return jsonify({'success': False, 'error': 'Drug not found'}), 404

        drug.is_active = False
        drug.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


# ============================================================================
# LOCATION MANAGEMENT
# ============================================================================
@bp.route('/locations', methods=['GET'])
def get_locations():
    """Get all active locations"""
    session = get_session(current_app.engine)
    try:
        locations = session.query(Location).filter_by(is_active=True).all()
        result = []
        for location in locations:
            result.append({
                'id': location.id,
                'name': location.name,
                'type': location.type,
                'parent_hub_id': location.parent_hub_id,
                'parent_hub_name': location.parent_hub.name if location.parent_hub else None,
                'created_at': location.created_at.isoformat()
            })
        return jsonify(result)
    finally:
        session.close()


@bp.route('/locations', methods=['POST'])
def create_location():
    """Create new location"""
    try:
        data = LocationCreate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        # Check if location name exists
        existing = session.query(Location).filter_by(name=data.name).first()
        if existing:
            return jsonify({'success': False, 'error': 'Location already exists'}), 409

        # Verify parent hub if specified
        if data.parent_hub_id:
            parent = session.query(Location).filter_by(
                id=data.parent_hub_id,
                type='HUB',
                is_active=True
            ).first()
            if not parent:
                return jsonify({'success': False, 'error': 'Invalid parent hub'}), 400

        location = Location(
            name=data.name,
            type=data.type,
            parent_hub_id=data.parent_hub_id,
            created_at=get_adelaide_now()
        )
        session.add(location)
        session.commit()

        return jsonify({'success': True, 'id': location.id}), 201
    finally:
        session.close()


@bp.route('/locations/<int:location_id>', methods=['PUT'])
def update_location(location_id):
    """Update location"""
    try:
        data = LocationUpdate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        location = session.query(Location).filter_by(id=location_id).first()
        if not location:
            return jsonify({'success': False, 'error': 'Location not found'}), 404

        # BUSINESS RULE: Parent hub locations cannot be edited
        # Port Augusta Hub (ID 1) and Whyalla Hub (ID 2) are protected
        PARENT_HUB_IDS = [1, 2]  # Port Augusta, Whyalla
        if location_id in PARENT_HUB_IDS:
            # Only allow minor updates, not name/type/parent_hub_id
            if data.name is not None or data.type is not None or data.parent_hub_id is not None:
                return jsonify({
                    'success': False,
                    'error': 'Parent hub locations cannot have their name, type, or parent_hub_id modified'
                }), 403

        if data.name is not None:
            # Check uniqueness
            existing = session.query(Location).filter(
                and_(Location.name == data.name, Location.id != location_id)
            ).first()
            if existing:
                return jsonify({'success': False, 'error': 'Location name already exists'}), 409
            location.name = data.name

        if data.type is not None:
            location.type = data.type

        if data.parent_hub_id is not None:
            if data.parent_hub_id != location.id:  # Can't be parent of self
                parent = session.query(Location).filter_by(
                    id=data.parent_hub_id,
                    type='HUB',
                    is_active=True
                ).first()
                if not parent:
                    return jsonify({'success': False, 'error': 'Invalid parent hub'}), 400
                location.parent_hub_id = data.parent_hub_id

        if data.is_active is not None:
            location.is_active = data.is_active

        location.updated_at = get_adelaide_now()
        location.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


@bp.route('/locations/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    """Delete location (with checks)"""
    session = get_session(current_app.engine)
    try:
        location = session.query(Location).filter_by(id=location_id).first()
        if not location:
            return jsonify({'success': False, 'error': 'Location not found'}), 404

        # BUSINESS RULE: Parent hub locations cannot be deleted
        # Port Augusta Hub (ID 1) and Whyalla Hub (ID 2) are protected
        PARENT_HUB_IDS = [1, 2]  # Port Augusta, Whyalla
        if location_id in PARENT_HUB_IDS:
            return jsonify({
                'success': False,
                'error': 'Parent hub locations cannot be deleted'
            }), 403

        # Check if location has users
        user_count = session.query(User).filter_by(location_id=location_id, is_active=True).count()
        if user_count > 0:
            return jsonify({'success': False, 'error': f'Cannot delete location with {user_count} active users'}), 400

        # Check if location has stock
        from models.database import Vial
        stock_count = session.query(Vial).filter(
            and_(Vial.location_id == location_id, Vial.status == 'AVAILABLE')
        ).count()
        if stock_count > 0:
            return jsonify({'success': False, 'error': f'Cannot delete location with {stock_count} items in stock'}), 400

        # Soft delete
        location.is_active = False
        location.version += 1
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()


# ============================================================================
# STOCK LEVELS
# ============================================================================
@bp.route('/stock_levels', methods=['GET'])
def get_stock_levels():
    """Get all stock levels"""
    session = get_session(current_app.engine)
    try:
        levels = session.query(StockLevel).all()
        result = []
        for level in levels:
            result.append({
                'id': level.id,
                'location_id': level.location_id,
                'location_name': level.location.name,
                'drug_id': level.drug_id,
                'drug_name': level.drug.name,
                'min_stock': level.min_stock
            })
        return jsonify(result)
    finally:
        session.close()


@bp.route('/stock_levels', methods=['PUT'])
def update_stock_levels():
    """Batch update stock levels"""
    updates = request.json.get('updates', [])

    if not updates:
        return jsonify({'success': False, 'error': 'No updates provided'}), 400

    session = get_session(current_app.engine)
    try:
        for update_data in updates:
            try:
                data = StockLevelUpdate(**update_data)
            except Exception as e:
                continue  # Skip invalid entries

            # Check if entry exists
            existing = session.query(StockLevel).filter_by(
                location_id=update_data['location_id'],
                drug_id=update_data['drug_id']
            ).first()

            if existing:
                existing.min_stock = data.min_stock
                existing.version += 1
            else:
                # Create new entry
                new_level = StockLevel(
                    location_id=update_data['location_id'],
                    drug_id=update_data['drug_id'],
                    min_stock=data.min_stock
                )
                session.add(new_level)

        session.commit()
        return jsonify({'success': True})
    finally:
        session.close()


# ============================================================================
# SETTINGS
# ============================================================================
@bp.route('/settings/<int:location_id>', methods=['GET'])
def get_settings(location_id):
    """Get settings for location"""
    session = get_session(current_app.engine)
    try:
        settings = session.query(Settings).filter_by(location_id=location_id).first()

        if not settings:
            return jsonify({})

        return jsonify({
            'id': settings.id,
            'location_id': settings.location_id,
            'printer_ip': settings.printer_ip,
            'printer_port': settings.printer_port,
            'label_width': settings.label_width,
            'label_height': settings.label_height,
            'margin_top': settings.margin_top,
            'margin_right': settings.margin_right,
            'email_notifications': settings.email_notifications,
            'sms_notifications': settings.sms_notifications,
            'updated_at': settings.updated_at.isoformat()
        })
    finally:
        session.close()


@bp.route('/settings/<int:location_id>', methods=['PUT'])
def update_settings(location_id):
    """Update settings for location"""
    try:
        data = SettingsUpdate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        settings = session.query(Settings).filter_by(location_id=location_id).first()

        if not settings:
            # Create new
            settings = Settings(location_id=location_id)
            session.add(settings)

        # Update fields
        if data.printer_ip is not None:
            settings.printer_ip = data.printer_ip

        if data.printer_port is not None:
            settings.printer_port = data.printer_port

        if data.label_width is not None:
            settings.label_width = data.label_width

        if data.label_height is not None:
            settings.label_height = data.label_height

        if data.margin_top is not None:
            settings.margin_top = data.margin_top

        if data.margin_right is not None:
            settings.margin_right = data.margin_right

        if data.email_notifications is not None:
            settings.email_notifications = data.email_notifications

        if data.sms_notifications is not None:
            settings.sms_notifications = data.sms_notifications

        settings.updated_at = get_adelaide_now()
        session.commit()

        return jsonify({'success': True})
    finally:
        session.close()
