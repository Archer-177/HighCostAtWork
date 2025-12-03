"""
Authentication routes
Login, logout, password management
"""
from flask import Blueprint, request, jsonify, current_app
from models.database import User, get_session
from models.schemas import UserLogin, PasswordChange, PasswordReset
from utils.helpers import verify_password, hash_password, get_adelaide_now
from datetime import datetime, timedelta
import random

bp = Blueprint('auth', __name__)


@bp.route('/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = UserLogin(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)

    try:
        user = session.query(User).filter_by(username=data.username, is_active=True).first()

        if not user:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

        if not verify_password(user.password_hash, data.password):
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

        # Update last login
        user.last_login = get_adelaide_now()
        session.commit()

        # Return user data
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'location_id': user.location_id,
                'location_name': user.location.name,
                'location_type': user.location.type,
                'parent_hub_id': user.location.parent_hub_id,
                'can_delegate': user.can_delegate,
                'is_supervisor': user.is_supervisor,
                'email': user.email,
                'must_change_password': user.must_change_password
            }
        })

    finally:
        session.close()


@bp.route('/change_password', methods=['POST'])
def change_password():
    """Change password"""
    try:
        data = PasswordChange(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)

    try:
        user = session.query(User).filter_by(username=data.username).first()

        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        if not verify_password(user.password_hash, data.old_password):
            return jsonify({'success': False, 'error': 'Invalid current password'}), 401

        user.password_hash = hash_password(data.new_password)
        user.must_change_password = False
        user.version += 1
        session.commit()

        return jsonify({'success': True})

    finally:
        session.close()


@bp.route('/forgot_password', methods=['POST'])
def forgot_password():
    """Request password reset code via SMS"""
    username = request.json.get('username')

    if not username:
        return jsonify({'success': False, 'error': 'Username required'}), 400

    session = get_session(current_app.engine)

    try:
        user = session.query(User).filter_by(username=username).first()

        # Security: Don't reveal if user exists
        if not user or not user.mobile_number:
            return jsonify({
                'success': True,
                'message': 'If this user exists and has a mobile number, a code has been sent.'
            })

        # Generate 6-digit code
        code = str(random.randint(100000, 999999))
        expiry = get_adelaide_now() + timedelta(minutes=15)

        user.reset_token = code
        user.reset_token_expiry = expiry
        user.version += 1
        session.commit()

        # TODO: Send SMS via Twilio
        # For now, log it
        from utils.helpers import setup_logger
        logger = setup_logger('auth')
        logger.info(f"Password reset code for {username}: {code}")

        return jsonify({
            'success': True,
            'message': 'If this user exists and has a mobile number, a code has been sent.'
        })

    finally:
        session.close()


@bp.route('/reset_password', methods=['POST'])
def reset_password():
    """Reset password with code"""
    try:
        data = PasswordReset(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)

    try:
        user = session.query(User).filter_by(username=data.username).first()

        if not user:
            return jsonify({'success': False, 'error': 'Invalid request'}), 400

        if user.reset_token != data.code:
            return jsonify({'success': False, 'error': 'Invalid code'}), 400

        if not user.reset_token_expiry or user.reset_token_expiry < get_adelaide_now():
            return jsonify({'success': False, 'error': 'Code expired'}), 400

        user.password_hash = hash_password(data.new_password)
        user.reset_token = None
        user.reset_token_expiry = None
        user.must_change_password = False
        user.version += 1
        session.commit()

        return jsonify({'success': True})

    finally:
        session.close()
