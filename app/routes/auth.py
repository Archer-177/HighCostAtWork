from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timedelta
import random
import sqlite3
from ..database import get_db
from ..utils import send_sms

bp = Blueprint('auth', __name__)

# 4. AUTHENTICATION
@bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    with get_db() as conn:
        print(f"DEBUG: Attempting login for username: {username}")
        user = conn.execute("""
            SELECT u.*, l.name as location_name, l.type as location_type, l.parent_hub_id
            FROM users u 
            JOIN locations l ON u.location_id = l.id 
            WHERE u.username = ?
        """, (username,)).fetchone()
        
        if user:
            print(f"DEBUG: User found: {user['username']}, ID: {user['id']}, Role: {user['role']}")
            # Check if active
            if not user['is_active']:
                 return jsonify({'success': False, 'error': 'Account is inactive'}), 401

            is_valid = check_password_hash(user['password_hash'], password)
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
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    location_id = data.get('location_id')
    can_delegate = data.get('can_delegate', 0)
    is_supervisor = data.get('is_supervisor', 0)
    email = data.get('email')
    mobile_number = data.get('mobile_number')

    if not all([username, password, role, location_id]):
        return jsonify({"error": "Missing required fields"}), 400

    with get_db() as conn:
        # Verify location exists
        loc = conn.execute("SELECT id FROM locations WHERE id = ?", (location_id,)).fetchone()
        if not loc:
             return jsonify({"error": "Invalid location"}), 400

        try:
            # New users must change password on first login
            conn.execute("""
                INSERT INTO users (username, password_hash, role, location_id, can_delegate, is_supervisor, email, mobile_number, must_change_password, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (username, generate_password_hash(password), role, location_id, can_delegate, is_supervisor, email, mobile_number, datetime.now()))
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
    data = request.json
    username = data.get('username')
    role = data.get('role')
    location_id = data.get('location_id')
    email = data.get('email')
    mobile_number = data.get('mobile_number')
    can_delegate = data.get('can_delegate', 0)
    is_supervisor = data.get('is_supervisor', 0)
    password = data.get('password') # Optional

    # Validate location_id
    if not location_id:
        return jsonify({"error": "Location is required"}), 400

    with get_db() as conn:
        # Verify location exists
        loc = conn.execute("SELECT id FROM locations WHERE id = ?", (location_id,)).fetchone()
        if not loc:
             return jsonify({"error": "Invalid location"}), 400

        try:
            if password:
                # If password is reset by supervisor, force change on next login
                conn.execute("""
                    UPDATE users 
                    SET username = ?, role = ?, location_id = ?, email = ?, mobile_number = ?, can_delegate = ?, is_supervisor = ?, password_hash = ?, must_change_password = 1, version = version + 1
                    WHERE id = ?
                """, (username, role, location_id, email, mobile_number, can_delegate, is_supervisor, generate_password_hash(password), user_id))
            else:
                conn.execute("""
                    UPDATE users 
                    SET username = ?, role = ?, location_id = ?, email = ?, mobile_number = ?, can_delegate = ?, is_supervisor = ?, version = version + 1
                    WHERE id = ?
                """, (username, role, location_id, email, mobile_number, can_delegate, is_supervisor, user_id))
            
            conn.commit()
            return jsonify({"success": True})
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 409

@bp.route('/api/change_password', methods=['POST'])
def change_password():
    data = request.json
    username = data.get('username')
    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')

    if not all([username, old_password, new_password]):
        return jsonify({"error": "Missing required fields"}), 400

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        if not check_password_hash(user['password_hash'], old_password):
            return jsonify({"error": "Invalid current password"}), 401

        try:
            conn.execute("""
                UPDATE users 
                SET password_hash = ?, must_change_password = 0, version = version + 1
                WHERE id = ?
            """, (generate_password_hash(new_password), user['id']))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@bp.route('/api/forgot_password', methods=['POST'])
def forgot_password():
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
        
    with get_db() as conn:
        print(f"DEBUG: Searching for user: {username}")
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
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
    data = request.json
    username = data.get('username')
    code = data.get('code')
    new_password = data.get('newPassword')
    
    if not all([username, code, new_password]):
        return jsonify({"error": "Missing required fields"}), 400
        
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
        if not user:
             return jsonify({"error": "Invalid request"}), 400
             
        # Verify code and expiry
        if user['reset_token'] != code:
            return jsonify({"error": "Invalid code"}), 400
            
        if datetime.strptime(user['reset_token_expiry'], '%Y-%m-%d %H:%M:%S') < datetime.now():
            return jsonify({"error": "Code expired"}), 400
            
        # Update password
        try:
            conn.execute("""
                UPDATE users 
                SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, must_change_password = 0, version = version + 1
                WHERE id = ?
            """, (generate_password_hash(new_password), user['id']))
            conn.commit()
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
