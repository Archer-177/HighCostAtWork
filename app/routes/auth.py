from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timedelta
import random
import sqlite3
from ..database import get_db
from ..utils import send_sms
from ..schemas import LoginRequest, UserCreateRequest, UserUpdateRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from pydantic import ValidationError

bp = Blueprint('auth', __name__)

# 4. AUTHENTICATION
@bp.route('/api/login', methods=['POST'])
def login():
    try:
        data = LoginRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        print(f"DEBUG: Attempting login for username: {data.username}")
        user = conn.execute("""
            SELECT u.*, l.name as location_name, l.type as location_type, l.parent_hub_id
            FROM users u 
            JOIN locations l ON u.location_id = l.id 
            WHERE u.username = ?
        """, (data.username,)).fetchone()
        
        if user:
            print(f"DEBUG: User found: {user['username']}, ID: {user['id']}, Role: {user['role']}")
            # Check if active
            if not user['is_active']:
                 return jsonify({'success': False, 'error': 'Account is inactive'}), 401

            is_valid = check_password_hash(user['password_hash'], data.password)
            print(f"DEBUG: Password valid: {is_valid}")
            
            if is_valid:
                return jsonify({
                    'success': True,
                    'user': {
                        'id': user['id'],
                        'username': user['username'],
                        'role': user['role'],
                        'location_id': user['location_id'],
                        'location_name': user['location_name'],
                        'location_type': user['location_type'],
                        'parent_hub_id': user['parent_hub_id'],
                        'can_delegate': bool(user['can_delegate']),
                        'is_supervisor': bool(user['is_supervisor']) if 'is_supervisor' in user.keys() else False,
                        'email': user['email'],
                        'must_change_password': bool(user['must_change_password']) if 'must_change_password' in user.keys() else False
                    }
                })
        else:
            print("DEBUG: User not found or JOIN failed")
    
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@bp.route('/api/users', methods=['GET', 'POST'])
def handle_users():
    if request.method == 'GET':
        with get_db() as conn:
            users = conn.execute("""
                SELECT u.*, l.name as location_name, l.parent_hub_id
                FROM users u
                JOIN locations l ON u.location_id = l.id
                WHERE u.is_active = 1
                ORDER BY u.username
            """).fetchall()
            return jsonify([dict(user) for user in users])
    
    # POST - Create new user
    try:
        data = UserCreateRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        # Verify location exists
        loc = conn.execute("SELECT id FROM locations WHERE id = ?", (data.location_id,)).fetchone()
        if not loc:
             return jsonify({"error": "Invalid location"}), 400

        try:
            # New users must change password on first login
            conn.execute("""
                INSERT INTO users (username, password_hash, role, location_id, can_delegate, is_supervisor, email, mobile_number, must_change_password, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (data.username, generate_password_hash(data.password), data.role, data.location_id, data.can_delegate, data.is_supervisor, data.email, data.mobile_number, datetime.now()))
            conn.commit()
            return jsonify({"success": True}), 201
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 409

@bp.route('/api/users/<int:user_id>', methods=['PUT', 'DELETE'])
def handle_user_detail(user_id):
    if request.method == 'DELETE':
        with get_db() as conn:
            # Soft delete: Set is_active = 0
            conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
            conn.commit()
            return jsonify({"success": True})

    # PUT - Update user
    try:
        data = UserUpdateRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        # Optimistic Locking Check
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        if data.version is not None and user['version'] != data.version:
            return jsonify({"error": "Data has changed. Please refresh."}), 409

        # Verify location exists
        if data.location_id:
            loc = conn.execute("SELECT id FROM locations WHERE id = ?", (data.location_id,)).fetchone()
            if not loc:
                return jsonify({"error": "Invalid location"}), 400

        try:
            if data.password:
                # If password is reset by supervisor, force change on next login
                conn.execute("""
                    UPDATE users 
                    SET username = ?, role = ?, location_id = ?, email = ?, mobile_number = ?, can_delegate = ?, is_supervisor = ?, password_hash = ?, must_change_password = 1, version = version + 1
                    WHERE id = ?
                """, (data.username, data.role, data.location_id, data.email, data.mobile_number, data.can_delegate, data.is_supervisor, generate_password_hash(data.password), user_id))
            else:
                conn.execute("""
                    UPDATE users 
                    SET username = ?, role = ?, location_id = ?, email = ?, mobile_number = ?, can_delegate = ?, is_supervisor = ?, version = version + 1
                    WHERE id = ?
                """, (data.username, data.role, data.location_id, data.email, data.mobile_number, data.can_delegate, data.is_supervisor, user_id))
            
            conn.commit()
            return jsonify({"success": True})
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 409

@bp.route('/api/change_password', methods=['POST'])
def change_password():
    try:
        data = ChangePasswordRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        if not check_password_hash(user['password_hash'], data.oldPassword):
            return jsonify({"error": "Invalid current password"}), 401

        try:
            conn.execute("""
                UPDATE users 
                SET password_hash = ?, must_change_password = 0, version = version + 1
                WHERE id = ?
            """, (generate_password_hash(data.newPassword), user['id']))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@bp.route('/api/forgot_password', methods=['POST'])
def forgot_password():
    try:
        data = ForgotPasswordRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        print(f"DEBUG: Searching for user: {data.username}")
        user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
        
        if not user:
            print("DEBUG: User not found in database")
        elif not user['mobile_number']:
            print(f"DEBUG: User found (ID: {user['id']}), but NO mobile number")
        else:
            print(f"DEBUG: User found (ID: {user['id']}), Mobile: {user['mobile_number']}")

        if not user or not user['mobile_number']:
            # Security: Don't reveal if user exists or has mobile
            return jsonify({"success": True, "message": "If this user exists and has a mobile number, a code has been sent."})
            
        # Generate 6-digit code
        code = str(random.randint(100000, 999999))
        expiry = (datetime.now() + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
        
        conn.execute("""
            UPDATE users 
            SET reset_token = ?, reset_token_expiry = ?, version = version + 1
            WHERE id = ?
        """, (code, expiry, user['id']))
        conn.commit()
        
        # Send SMS
        body = f"Your FUNLHN Password Reset Code is: {code}. Expires in 15 mins."
        send_sms(user['mobile_number'], body)
        
        return jsonify({"success": True, "message": "If this user exists and has a mobile number, a code has been sent."})

@bp.route('/api/reset_password', methods=['POST'])
def reset_password():
    try:
        data = ResetPasswordRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422
        
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
        
        if not user:
             return jsonify({"error": "Invalid request"}), 400
             
        # Verify code and expiry
        if user['reset_token'] != data.code:
            return jsonify({"error": "Invalid code"}), 400
            
        if datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S') < datetime.now():
            return jsonify({"error": "Code expired"}), 400
            
        # Update password
        try:
            conn.execute("""
                UPDATE users 
                SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, must_change_password = 0, version = version + 1
                WHERE id = ?
            """, (generate_password_hash(data.newPassword), user['id']))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
