import os, sys, time, threading, sqlite3, shutil, queue, socket, glob
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from twilio.rest import Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# PATH SETUP (Frozen vs Script)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    STATIC_FOLDER = os.path.join(sys._MEIPASS, 'build')
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_FOLDER = os.path.join(BASE_DIR, 'frontend', 'build')

DB_FILE = os.path.join(BASE_DIR, 'sys_data.dat')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LOG_FILE = os.path.join(BASE_DIR, 'debug_log.txt')

# Create backup directory if it doesn't exist
os.makedirs(BACKUP_DIR, exist_ok=True)

# Configure logging
logging.basicConfig(filename=LOG_FILE, level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='/')
CORS(app)

# 1. WRITE QUEUE for concurrent access
write_queue = queue.Queue()

def worker():
    while True:
        func, args, res_q = write_queue.get()
        try:
            res_q.put(func(*args))
        except Exception as e:
            logging.error(f"Write queue error: {str(e)}")
            res_q.put(e)
        finally:
            write_queue.task_done()

threading.Thread(target=worker, daemon=True).start()

def queue_write(func, *args):
    q = queue.Queue()
    write_queue.put((func, args, q))
    res = q.get()
    if isinstance(res, Exception):
        raise res
    return res

# 2. DB HELPERS
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA journal_mode = DELETE")
    conn.execute("PRAGMA synchronous = FULL")
    return conn

# 3. DATABASE INITIALIZATION
def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('PHARMACIST', 'PHARMACY_TECH', 'NURSE')),
                location_id INTEGER NOT NULL,
                can_delegate BOOLEAN DEFAULT 0,
                is_supervisor BOOLEAN DEFAULT 0,
                email TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (location_id) REFERENCES locations(id)
            )
        ''')
        
        # Locations table (Hub pharmacies, wards, remote sites)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('HUB', 'WARD', 'REMOTE')),
                parent_hub_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (parent_hub_id) REFERENCES locations(id)
            )
        ''')
        
        # Drug catalog
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS drugs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                storage_temp TEXT,
                unit_price REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1
            )
        ''')
        
        # Stock levels per location
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stock_levels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location_id INTEGER NOT NULL,
                drug_id INTEGER NOT NULL,
                min_stock INTEGER DEFAULT 0,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (location_id) REFERENCES locations(id),
                FOREIGN KEY (drug_id) REFERENCES drugs(id),
                UNIQUE(location_id, drug_id)
            )
        ''')
        
        # Individual vial tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT UNIQUE NOT NULL,
                drug_id INTEGER NOT NULL,
                batch_number TEXT NOT NULL,
                expiry_date DATE NOT NULL,
                location_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'AVAILABLE' 
                    CHECK(status IN ('AVAILABLE', 'USED_CLINICAL', 'DISCARDED', 'IN_TRANSIT')),
                discard_reason TEXT,
                patient_mrn TEXT,
                clinical_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP,
                used_by INTEGER,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (drug_id) REFERENCES drugs(id),
                FOREIGN KEY (location_id) REFERENCES locations(id),
                FOREIGN KEY (used_by) REFERENCES users(id)
            )
        ''')
        
        # Add columns to existing vials table if they don't exist
        try:
            cursor.execute("ALTER TABLE vials ADD COLUMN patient_mrn TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        try:
            cursor.execute("ALTER TABLE vials ADD COLUMN clinical_notes TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Add is_supervisor column to users table if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN is_supervisor BOOLEAN DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Add must_change_password column to users table if it doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Add reset_token and reset_token_expiry columns
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
        except sqlite3.OperationalError:
            pass
            
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP")
        except sqlite3.OperationalError:
            pass

        # Add mobile_number column
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN mobile_number TEXT")
        except sqlite3.OperationalError:
            pass

        
        # Stock transfers
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_location_id INTEGER NOT NULL,
                to_location_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING' 
                    CHECK(status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
                created_by INTEGER NOT NULL,
                approved_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP,
                completed_at TIMESTAMP,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (from_location_id) REFERENCES locations(id),
                FOREIGN KEY (to_location_id) REFERENCES locations(id),
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        ''')
        
        # Transfer items
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transfer_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_id INTEGER NOT NULL,
                vial_id INTEGER NOT NULL,
                FOREIGN KEY (transfer_id) REFERENCES transfers(id),
                FOREIGN KEY (vial_id) REFERENCES vials(id)
            )
        ''')
        
        # Audit log
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        # Settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                printer_ip TEXT,
                printer_port TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert initial data if empty
        cursor.execute("SELECT COUNT(*) FROM locations")
        if cursor.fetchone()[0] == 0:
            # Insert hub locations
            cursor.execute("INSERT INTO locations (name, type) VALUES ('Port Augusta Hospital Pharmacy', 'HUB')")
            pa_hub_id = cursor.lastrowid
            cursor.execute("INSERT INTO locations (name, type) VALUES ('Whyalla Hospital Pharmacy', 'HUB')")
            wh_hub_id = cursor.lastrowid
            
            # Insert wards
            cursor.execute("INSERT INTO locations (name, type, parent_hub_id) VALUES ('Port Augusta ED', 'WARD', ?)", (pa_hub_id,))
            cursor.execute("INSERT INTO locations (name, type, parent_hub_id) VALUES ('Whyalla HDU', 'WARD', ?)", (wh_hub_id,))
            cursor.execute("INSERT INTO locations (name, type, parent_hub_id) VALUES ('Whyalla ED', 'WARD', ?)", (wh_hub_id,))
            
            # Insert remote sites (all under Port Augusta)
            remote_sites = ['Roxby Downs', 'Quorn', 'Hawker', 'Leigh Creek', 'Oodnadatta']
            for site in remote_sites:
                cursor.execute("INSERT INTO locations (name, type, parent_hub_id) VALUES (?, 'REMOTE', ?)", (site, pa_hub_id))
            
            # Insert sample drugs
            cursor.execute("INSERT INTO drugs (name, category, storage_temp, unit_price) VALUES ('Tenecteplase', 'Thrombolytic', '<25°C', 2500.00)")
            cursor.execute("INSERT INTO drugs (name, category, storage_temp, unit_price) VALUES ('Red Back Spider Antivenom', 'Antivenom', '2-8°C', 850.00)")
            cursor.execute("INSERT INTO drugs (name, category, storage_temp, unit_price) VALUES ('Brown Snake Antivenom', 'Antivenom', '2-8°C', 1200.00)")
            
            # Insert default admin user (password: admin123)
            cursor.execute("""
                INSERT INTO users (username, password_hash, role, location_id, can_delegate, is_supervisor, email) 
                VALUES ('admin', ?, 'PHARMACIST', ?, 1, 1, 'admin@funlhn.health')
            """, (generate_password_hash('admin123'), pa_hub_id))

        # --- POPULATE SAMPLE STOCK & LEVELS (If missing) ---
        cursor.execute("SELECT COUNT(*) FROM stock_levels")
        if cursor.fetchone()[0] == 0:
            locations = cursor.execute("SELECT id, type, name FROM locations").fetchall()
            drugs = cursor.execute("SELECT id, name FROM drugs").fetchall()
            
            import random
            
            # Set min stock levels for all drugs at all locations
            for loc in locations:
                for drug in drugs:
                    min_stock = 10 if loc['type'] == 'HUB' else 2
                    cursor.execute("""
                        INSERT INTO stock_levels (location_id, drug_id, min_stock)
                        VALUES (?, ?, ?)
                    """, (loc['id'], drug['id'], min_stock))
            
            # Get specific drug IDs
            tenecteplase_id = None
            antivenom_ids = []
            for drug in drugs:
                if drug['name'] == 'Tenecteplase':
                    tenecteplase_id = drug['id']
                elif 'Antivenom' in drug['name']:
                    antivenom_ids.append(drug['id'])
            
            # --- TENECTEPLASE: 20 vials across 3 batches ---
            if tenecteplase_id:
                tenecteplase_batches = [
                    ('TNK-2024-A', 7, 135),   # Batch A: 7 vials, ~135 days (healthy)
                    ('TNK-2024-B', 7, 60),    # Batch B: 7 vials, ~60 days (warning)
                    ('TNK-2024-C', 6, 20)     # Batch C: 6 vials, ~20 days (critical)
                ]
                
                vial_idx = 0
                for batch_num, count, days_offset in tenecteplase_batches:
                    expiry_date = (datetime.now() + timedelta(days=days_offset)).strftime('%Y-%m-%d')
                    
                    for _ in range(count):
                        # Distribute across locations
                        loc = locations[vial_idx % len(locations)]
                        asset_id = f"TNK-{str(uuid.uuid4())[:8].upper()}"
                        
                        cursor.execute("""
                            INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status)
                            VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
                        """, (asset_id, tenecteplase_id, batch_num, expiry_date, loc['id']))
                        vial_idx += 1
            
            # --- ANTIVENOMS: 2 batches each, 5 vials per batch (10 per antivenom type) ---
            for antivenom_id in antivenom_ids:
                antivenom_batches = [
                    ('AV-2024-X', 5, 75),     # Batch X: 5 vials, ~75 days (warning/healthy)
                    ('AV-2024-Y', 5, 150)     # Batch Y: 5 vials, ~150 days (healthy)
                ]
                
                vial_idx = 0
                for batch_num, count, days_offset in antivenom_batches:
                    expiry_date = (datetime.now() + timedelta(days=days_offset)).strftime('%Y-%m-%d')
                    
                    for _ in range(count):
                        loc = locations[vial_idx % len(locations)]
                        asset_id = f"AV-{str(uuid.uuid4())[:8].upper()}"
                        
                        cursor.execute("""
                            INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status)
                            VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
                        """, (asset_id, antivenom_id, batch_num, expiry_date, loc['id']))
                        vial_idx += 1

        
        conn.commit()

# 4. AUTHENTICATION
@app.route('/api/login', methods=['POST'])
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

# 5. STOCK OPERATIONS
def receive_stock_logic(drug_id, batch_number, expiry_date, quantity, location_id, user_id):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get drug info
        drug = cursor.execute("SELECT * FROM drugs WHERE id = ?", (drug_id,)).fetchone()
        if not drug:
            return {"error": "Drug not found"}, 404
        
        # Generate unique asset IDs
        asset_ids = []
        for i in range(quantity):
            asset_id = f"AST-{str(uuid.uuid4())[:8].upper()}"
            cursor.execute("""
                INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status)
                VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
            """, (asset_id, drug_id, batch_number, expiry_date, location_id))
            asset_ids.append(asset_id)
        
        # Log the action
        cursor.execute("""
            INSERT INTO audit_log (user_id, action, details)
            VALUES (?, 'RECEIVE_STOCK', ?)
        """, (user_id, json.dumps({
            'drug': drug['name'],
            'quantity': quantity,
            'batch': batch_number,
            'expiry': expiry_date,
            'asset_ids': asset_ids
        })))
        
        conn.commit()
        
        return {
            "success": True,
            "asset_ids": asset_ids,
            "drug_name": drug['name'],
            "total_value": drug['unit_price'] * quantity
        }, 200

@app.route('/api/receive_stock', methods=['POST'])
def receive_stock():
    data = request.json
    result, status = queue_write(
        receive_stock_logic,
        data['drug_id'],
        data['batch_number'],
        data['expiry_date'],
        data['quantity'],
        data['location_id'],
        data['user_id']
    )
    return jsonify(result), status

# 6. USE/DISCARD STOCK
def use_stock_logic(vial_id, user_id, action, discard_reason=None, user_version=None, patient_mrn=None, clinical_notes=None):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get vial with version check
        vial = cursor.execute("SELECT * FROM vials WHERE id = ?", (vial_id,)).fetchone()
        if not vial:
            return {"error": "Vial not found"}, 404
        
        # Optimistic Locking Check
        if user_version is not None and vial['version'] != user_version:
            return {"error": "Data has changed. Please refresh."}, 409
        
        if vial['status'] != 'AVAILABLE':
            return {"error": f"Vial is already {vial['status']}"}, 400
        
        # Update status
        new_status = 'USED_CLINICAL' if action == 'USE' else 'DISCARDED'
        cursor.execute("""
            UPDATE vials 
            SET status = ?, used_at = CURRENT_TIMESTAMP, used_by = ?, 
                discard_reason = ?, patient_mrn = ?, clinical_notes = ?, version = version + 1
            WHERE id = ?
        """, (new_status, user_id, discard_reason, patient_mrn, clinical_notes, vial_id))
        
        # Check if stock is below minimum
        cursor.execute("""
            SELECT 
                COUNT(*) as available_count,
                sl.min_stock,
                d.name as drug_name,
                l.name as location_name
            FROM vials v
            JOIN drugs d ON v.drug_id = d.id
            JOIN locations l ON v.location_id = l.id
            LEFT JOIN stock_levels sl ON sl.location_id = v.location_id AND sl.drug_id = v.drug_id
            WHERE v.location_id = ? AND v.drug_id = ? AND v.status = 'AVAILABLE'
            GROUP BY d.name, l.name, sl.min_stock
        """, (vial['location_id'], vial['drug_id']))
        
        stock_info = cursor.fetchone()
        
        # Log the action
        cursor.execute("""
            INSERT INTO audit_log (user_id, action, details)
            VALUES (?, ?, ?)
        """, (user_id, action + '_STOCK', json.dumps({
            'asset_id': vial['asset_id'],
            'drug_id': vial['drug_id'],
            'discard_reason': discard_reason
        })))
        
        conn.commit()
        
        # Check if notification needed
        needs_notification = stock_info and stock_info['min_stock'] and stock_info['available_count'] < stock_info['min_stock']
        
        return {
            "success": True,
            "needs_notification": needs_notification,
            "stock_info": dict(stock_info) if stock_info else None
        }, 200

@app.route('/api/use_stock', methods=['POST'])
def use_stock():
    data = request.json
    # Pass user_version and clinical info to logic
    result, status = queue_write(
        use_stock_logic,
        data['vial_id'],
        data['user_id'],
        data['action'],
        data.get('discard_reason'),
        data.get('version'),
        data.get('patient_mrn'),
        data.get('clinical_notes')
    )

    # Send notification if needed
    if status == 200 and result.get('needs_notification'):
        send_low_stock_notification(result['stock_info'])
    
    return jsonify(result), status

# 7. STOCK TRANSFERS
def create_transfer_logic(from_location_id, to_location_id, vial_ids, created_by):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check if transfer needs approval
        from_loc = cursor.execute("SELECT * FROM locations WHERE id = ?", (from_location_id,)).fetchone()
        to_loc = cursor.execute("SELECT * FROM locations WHERE id = ?", (to_location_id,)).fetchone()
        
        # Determine if approval needed (Whyalla transfers)
        # Determine if approval needed (Hub -> Hub)
        needs_approval = (
            from_loc['type'] == 'HUB' and 
            to_loc['type'] == 'HUB' and 
            from_loc['id'] != to_loc['id']
        )

        # Determine if immediate completion (Hub -> Own Ward)
        is_immediate = (
            from_loc['type'] == 'HUB' and 
            to_loc['type'] == 'WARD' and 
            to_loc['parent_hub_id'] == from_loc['id']
        )
        
        status = 'PENDING' if needs_approval else ('COMPLETED' if is_immediate else 'IN_TRANSIT')

        # Create transfer
        cursor.execute("""
            INSERT INTO transfers (from_location_id, to_location_id, created_by, status, completed_at)
            VALUES (?, ?, ?, ?, ?)
        """, (from_location_id, to_location_id, created_by, status, datetime.now() if is_immediate else None))
        
        transfer_id = cursor.lastrowid
        
        # Add vials to transfer
        for vial_id in vial_ids:
            cursor.execute("""
                INSERT INTO transfer_items (transfer_id, vial_id)
                VALUES (?, ?)
            """, (transfer_id, vial_id))
            
            # Update vial status
            if status == 'COMPLETED':
                cursor.execute("""
                    UPDATE vials SET status = 'AVAILABLE', location_id = ?, version = version + 1
                    WHERE id = ?
                """, (to_location_id, vial_id))
            elif status == 'IN_TRANSIT':
                cursor.execute("""
                    UPDATE vials SET status = 'IN_TRANSIT', version = version + 1
                    WHERE id = ?
                """, (vial_id,))
        
        conn.commit()
        
        return {
            "success": True,
            "transfer_id": transfer_id,
            "needs_approval": needs_approval,
            "status": status
        }, 200

@app.route('/api/create_transfer', methods=['POST'])
def create_transfer():
    data = request.json
    result, status = queue_write(
        create_transfer_logic,
        data['from_location_id'],
        data['to_location_id'],
        data['vial_ids'],
        data['created_by']
    )
    return jsonify(result), status

# 8. DASHBOARD DATA
@app.route('/api/dashboard/<int:user_id>', methods=['GET'])
def get_dashboard(user_id):
    with get_db() as conn:
        # Get user info
        user = conn.execute("""
            SELECT u.*, l.name as location_name, l.type as location_type
            FROM users u
            JOIN locations l ON u.location_id = l.id
            WHERE u.id = ?
        """, (user_id,)).fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Get stock based on user role and location
        if user['role'] in ['PHARMACIST', 'PHARMACY_TECH']:
            # Can see all locations
            stock_query = """
                SELECT 
                    v.*, 
                    d.name as drug_name, 
                    d.category, 
                    d.storage_temp,
                    d.unit_price,
                    l.name as location_name,
                    l.type as location_type,
                    julianday(v.expiry_date) - julianday('now') as days_until_expiry
                FROM vials v
                JOIN drugs d ON v.drug_id = d.id
                JOIN locations l ON v.location_id = l.id
                WHERE v.status = 'AVAILABLE'
                ORDER BY v.expiry_date ASC
            """
            stock = conn.execute(stock_query).fetchall()
        else:
            # Nurses see only their location
            stock_query = """
                SELECT 
                    v.*, 
                    d.name as drug_name, 
                    d.category, 
                    d.storage_temp,
                    d.unit_price,
                    l.name as location_name,
                    l.type as location_type,
                    julianday(v.expiry_date) - julianday('now') as days_until_expiry
                FROM vials v
                JOIN drugs d ON v.drug_id = d.id
                JOIN locations l ON v.location_id = l.id
                WHERE v.status = 'AVAILABLE' AND v.location_id = ?
                ORDER BY v.expiry_date ASC
            """
            stock = conn.execute(stock_query, (user['location_id'],)).fetchall()
        
        # Get summary statistics
        stats = {
            'total_stock': len(stock),
            'expiring_soon': sum(1 for s in stock if s['days_until_expiry'] <= 30),
            'warning_stock': sum(1 for s in stock if 30 < s['days_until_expiry'] <= 90),
            'healthy_stock': sum(1 for s in stock if s['days_until_expiry'] > 90)
        }
        
        # Convert to dict
        stock_list = []
        for item in stock:
            stock_dict = dict(item)
            # Determine status color
            if stock_dict['days_until_expiry'] <= 30:
                stock_dict['status_color'] = 'red'
            elif stock_dict['days_until_expiry'] <= 90:
                stock_dict['status_color'] = 'amber'
            else:
                stock_dict['status_color'] = 'green'
            stock_list.append(stock_dict)
        
        return jsonify({
            'user': dict(user),
            'stock': stock_list,
            'stats': stats
        })



# Additional API endpoints for complete functionality
@app.route('/api/locations/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check dependencies
        # 1. Users assigned to this location
        users = cursor.execute("SELECT COUNT(*) FROM users WHERE location_id = ?", (location_id,)).fetchone()[0]
        if users > 0:
            return jsonify({"error": "Cannot delete location with assigned users"}), 400
            
        # 2. Stock (vials) at this location
        stock = cursor.execute("SELECT COUNT(*) FROM vials WHERE location_id = ?", (location_id,)).fetchone()[0]
        if stock > 0:
            return jsonify({"error": "Cannot delete location with existing stock"}), 400
            
        # 3. Transfers involving this location
        transfers = cursor.execute("SELECT COUNT(*) FROM transfers WHERE from_location_id = ? OR to_location_id = ?", (location_id, location_id)).fetchone()[0]
        if transfers > 0:
            return jsonify({"error": "Cannot delete location with transfer history"}), 400

        cursor.execute("DELETE FROM locations WHERE id = ?", (location_id,))
        conn.commit()
        return jsonify({"success": True})

@app.route('/api/locations', methods=['GET', 'POST'])
def handle_locations():
    if request.method == 'GET':
        with get_db() as conn:
            locations = conn.execute("SELECT * FROM locations ORDER BY type, name").fetchall()
            return jsonify([dict(location) for location in locations])
    
    # POST - Create new location
    data = request.json
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO locations (name, type, parent_hub_id)
            VALUES (?, ?, ?)
        """, (data['name'], data['type'], data.get('parent_hub_id')))
        conn.commit()
        return jsonify({"success": True, "id": cursor.lastrowid})

@app.route('/api/drugs', methods=['GET', 'POST'])
def handle_drugs():
    if request.method == 'GET':
        with get_db() as conn:
            drugs = conn.execute("SELECT * FROM drugs ORDER BY name").fetchall()
            return jsonify([dict(drug) for drug in drugs])

    # POST - Create new drug
    data = request.json
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drugs (name, category, storage_temp, unit_price)
            VALUES (?, ?, ?, ?)
        """, (data['name'], data['category'], data['storage_temp'], data['unit_price']))
        conn.commit()
        return jsonify({"success": True, "id": cursor.lastrowid})

@app.route('/api/stock_levels', methods=['GET', 'PUT'])
def handle_stock_levels():
    if request.method == 'GET':
        with get_db() as conn:
            levels = conn.execute("""
                SELECT * FROM stock_levels ORDER BY location_id, drug_id
            """).fetchall()
            return jsonify([dict(level) for level in levels])
    
    # PUT - Update multiple stock levels
    data = request.json
    updates = data.get('updates', [])
    
    def update_logic():
        with get_db() as conn:
            cursor = conn.cursor()
            for update in updates:
                location_id = update['location_id']
                drug_id = update['drug_id']
                min_stock = update['min_stock']
                
                # Check if entry exists
                existing = cursor.execute("""
                    SELECT id FROM stock_levels 
                    WHERE location_id = ? AND drug_id = ?
                """, (location_id, drug_id)).fetchone()
                
                if existing:
                    cursor.execute("""
                        UPDATE stock_levels 
                        SET min_stock = ?
                        WHERE location_id = ? AND drug_id = ?
                    """, (min_stock, location_id, drug_id))
                else:
                    cursor.execute("""
                        INSERT INTO stock_levels (location_id, drug_id, min_stock)
                        VALUES (?, ?, ?)
                    """, (location_id, drug_id, min_stock))
            
            conn.commit()
            return {"success": True}, 200
    
    result, status = queue_write(update_logic)
    return jsonify(result), status

@app.route('/api/stock/<int:location_id>', methods=['GET'])
def get_location_stock(location_id):
    with get_db() as conn:
        stock = conn.execute("""
            SELECT 
                v.*, 
                d.name as drug_name,
                julianday(v.expiry_date) - julianday('now') as days_until_expiry
            FROM vials v
            JOIN drugs d ON v.drug_id = d.id
            WHERE v.location_id = ? AND v.status = 'AVAILABLE'
            ORDER BY v.expiry_date ASC
        """, (location_id,)).fetchall()
        return jsonify([dict(item) for item in stock])

@app.route('/api/stock/all', methods=['GET'])
def get_all_stock_status():
    with get_db() as conn:
        # Get all locations
        locations = conn.execute("SELECT id FROM locations").fetchall()
        status_map = {}
        
        for loc in locations:
            loc_id = loc['id']
            status_data = {
                'expiry': 'healthy',
                'level': 'healthy'
            }
            
            # --- 1. Expiry Status ---
            # Check for critical items (expired or expiring < 30 days)
            critical_expiry = conn.execute("""
                SELECT COUNT(*) as count FROM vials 
                WHERE location_id = ? AND status = 'AVAILABLE' 
                AND (julianday(expiry_date) - julianday('now')) < 30
            """, (loc_id,)).fetchone()['count']
            
            if critical_expiry > 0:
                status_data['expiry'] = 'critical'
            else:
                # Check for warning items (expiring < 90 days)
                warning_expiry = conn.execute("""
                    SELECT COUNT(*) as count FROM vials 
                    WHERE location_id = ? AND status = 'AVAILABLE' 
                    AND (julianday(expiry_date) - julianday('now')) < 90
                """, (loc_id,)).fetchone()['count']
                
                if warning_expiry > 0:
                    status_data['expiry'] = 'warning'
            
            # --- 2. Stock Level Status ---
            # Check if ANY drug is below minimum stock
            # We need to check each drug that has a min_stock defined for this location
            low_stock_items = conn.execute("""
                SELECT COUNT(*) as count
                FROM stock_levels sl
                LEFT JOIN (
                    SELECT location_id, drug_id, COUNT(*) as current_stock
                    FROM vials
                    WHERE status = 'AVAILABLE'
                    GROUP BY location_id, drug_id
                ) v ON sl.location_id = v.location_id AND sl.drug_id = v.drug_id
                WHERE sl.location_id = ? 
                AND (COALESCE(v.current_stock, 0) < sl.min_stock)
            """, (loc_id,)).fetchone()['count']
            
            if low_stock_items > 0:
                status_data['level'] = 'critical' # Red if below min levels
            
            status_map[loc_id] = status_data
                
        return jsonify(status_map)

@app.route('/api/transfers/<int:location_id>', methods=['GET'])
def get_transfers(location_id):
    with get_db() as conn:
        transfers = conn.execute("""
            SELECT 
                t.*,
                fl.name as from_location,
                fl.type as from_location_type,
                tl.name as to_location,
                tl.type as to_location_type,
                tl.type as to_location_type,
                u.username as created_by_name,
                u.location_id as created_by_location_id,
                COUNT(ti.id) as item_count
            FROM transfers t
            JOIN locations fl ON t.from_location_id = fl.id
            JOIN locations tl ON t.to_location_id = tl.id
            JOIN users u ON t.created_by = u.id
            LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
            WHERE t.from_location_id = ? OR t.to_location_id = ?
            GROUP BY t.id
            ORDER BY t.created_at DESC
        """, (location_id, location_id)).fetchall()
        
        # Convert to list of dicts and fetch items for each transfer
        transfer_list = []
        for t in transfers:
            t_dict = dict(t)
            
            # Fetch items for this transfer
            items = conn.execute("""
                SELECT 
                    v.id, v.asset_id, v.batch_number, v.expiry_date,
                    d.name as drug_name, d.category, d.storage_temp, d.unit_price,
                    julianday(v.expiry_date) - julianday('now') as days_until_expiry
                FROM transfer_items ti
                JOIN vials v ON ti.vial_id = v.id
                JOIN drugs d ON v.drug_id = d.id
                WHERE ti.transfer_id = ?
            """, (t['id'],)).fetchall()
            
            # Process items to add status_color
            processed_items = []
            for item in items:
                item_dict = dict(item)
                days = item_dict['days_until_expiry'] or 0
                if days <= 30:
                    item_dict['status_color'] = 'red'
                elif days <= 90:
                    item_dict['status_color'] = 'amber'
                else:
                    item_dict['status_color'] = 'green'
                processed_items.append(item_dict)
            
            t_dict['items'] = processed_items
            transfer_list.append(t_dict)
            
        return jsonify(transfer_list)

@app.route('/api/transfer/<int:transfer_id>/<string:action>', methods=['POST'])
def handle_transfer_action(transfer_id, action):
    data = request.json
    user_id = data.get('user_id')
    user_version = data.get('version')
    
    def update_transfer_logic():
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get transfer for version check
            transfer = cursor.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,)).fetchone()
            if not transfer:
                return {"error": "Transfer not found"}, 404
                
            # Optimistic Locking Check
            if user_version is not None and transfer['version'] != user_version:
                return {"error": "Data has changed. Please refresh."}, 409
            
            if action == 'approve':
                # Verify approver is from the "Other Hub" (Non-initiating hub)
                creator = cursor.execute("SELECT location_id FROM users WHERE id = ?", (transfer['created_by'],)).fetchone()
                approver = cursor.execute("SELECT location_id FROM users WHERE id = ?", (user_id,)).fetchone()
                
                if not creator or not approver:
                     return {"error": "User data not found"}, 404

                # Determine the "Other Hub"
                # If creator is at From_Loc, approval must come from To_Loc (Push)
                # If creator is at To_Loc, approval must come from From_Loc (Pull)
                
                required_approver_location = None
                if creator['location_id'] == transfer['from_location_id']:
                    required_approver_location = transfer['to_location_id']
                elif creator['location_id'] == transfer['to_location_id']:
                    required_approver_location = transfer['from_location_id']
                else:
                    # Creator is not at either hub (e.g. Admin at third location)? 
                    # Fallback to receiving hub for safety, or block.
                    # For now, let's enforce receiving hub as default if creator is external
                    required_approver_location = transfer['to_location_id']

                if approver['location_id'] != required_approver_location:
                    return {"error": "Only pharmacists from the other hub can approve this transfer"}, 403

                # Prevent self-approval
                if user_id == transfer['created_by']:
                    return {"error": "You cannot approve your own transfer request"}, 403

                # STRICT CHECK: Only update if status is PENDING
                cursor.execute("""
                    UPDATE transfers 
                    SET status = 'IN_TRANSIT', approved_by = ?, approved_at = CURRENT_TIMESTAMP, version = version + 1
                    WHERE id = ? AND status = 'PENDING'
                """, (user_id, transfer_id))
                
                if cursor.rowcount == 0:
                    return {"error": "Transfer is not in PENDING state or has already been modified"}, 400

                # Update vial statuses
                cursor.execute("""
                    UPDATE vials 
                    SET status = 'IN_TRANSIT', version = version + 1
                    WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
                """, (transfer_id,))
                
            elif action == 'complete':
                # STRICT CHECK: Only update if status is IN_TRANSIT
                cursor.execute("""
                    UPDATE transfers 
                    SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, version = version + 1
                    WHERE id = ? AND status = 'IN_TRANSIT'
                """, (transfer_id,))
                
                if cursor.rowcount == 0:
                    return {"error": "Transfer is not in IN_TRANSIT state or has already been modified"}, 400
                
                # Move vials to destination
                cursor.execute("""
                    UPDATE vials 
                    SET status = 'AVAILABLE', location_id = ?, version = version + 1
                    WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
                """, (transfer['to_location_id'], transfer_id))
                
            elif action == 'cancel':
                # STRICT CHECK: Only update if status is PENDING
                cursor.execute("""
                    UPDATE transfers 
                    SET status = 'CANCELLED', version = version + 1
                    WHERE id = ? AND status = 'PENDING'
                """, (transfer_id,))
                
                if cursor.rowcount == 0:
                    return {"error": "Transfer is not in PENDING state or has already been modified"}, 400
                
                # Release vials back to source
                cursor.execute("""
                    UPDATE vials 
                    SET status = 'AVAILABLE', version = version + 1
                    WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
                """, (transfer_id,))
            
            conn.commit()
            return {"success": True}, 200

    result, status = queue_write(update_transfer_logic)
    return jsonify(result), status


@app.route('/api/users', methods=['GET', 'POST'])
def handle_users():
    if request.method == 'GET':
        with get_db() as conn:
            users = conn.execute("""
                SELECT u.*, l.name as location_name
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
                INSERT INTO users (username, password_hash, role, location_id, can_delegate, is_supervisor, email, mobile_number, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (username, generate_password_hash(password), role, location_id, can_delegate, is_supervisor, email, mobile_number))
            conn.commit()
            return jsonify({"success": True}), 201
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 409

@app.route('/api/users/<int:user_id>', methods=['PUT', 'DELETE'])
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

@app.route('/api/change_password', methods=['POST'])
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

@app.route('/api/forgot_password', methods=['POST'])
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
        import random
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

@app.route('/api/reset_password', methods=['POST'])
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


# 9. REPORTS
@app.route('/api/reports/usage', methods=['GET'])
def usage_report():
    start_date = request.args.get('start_date', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
    end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
    
    with get_db() as conn:
        # Get usage statistics
        usage = conn.execute("""
            SELECT 
                d.name as drug_name,
                l.name as location_name,
                COUNT(CASE WHEN v.status = 'USED_CLINICAL' THEN 1 END) as clinical_use,
                COUNT(CASE WHEN v.status = 'DISCARDED' THEN 1 END) as wastage,
                SUM(CASE WHEN v.status = 'USED_CLINICAL' THEN d.unit_price ELSE 0 END) as clinical_value,
                SUM(CASE WHEN v.status = 'DISCARDED' THEN d.unit_price ELSE 0 END) as wastage_value
            FROM vials v
            JOIN drugs d ON v.drug_id = d.id
            JOIN locations l ON v.location_id = l.id
            WHERE v.used_at BETWEEN ? AND ?
            GROUP BY d.name, l.name
        """, (start_date, end_date)).fetchall()
        
        return jsonify({
            'start_date': start_date,
            'end_date': end_date,
            'data': [dict(row) for row in usage]
        })

@app.route('/api/reports/export_pdf', methods=['POST'])
def export_pdf():
    data = request.json
    report_data = data.get('report_data', [])
    stats = data.get('stats', {})
    
    filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(STATIC_FOLDER, filename)
    
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    elements.append(Paragraph("Medicine Usage & Wastage Report", styles['Title']))
    elements.append(Spacer(1, 12))
    
    # Stats
    elements.append(Paragraph(f"Total Clinical Value: ${stats.get('totalClinicalValue', 0):,.2f}", styles['Normal']))
    elements.append(Paragraph(f"Total Wastage Value: ${stats.get('totalWastageValue', 0):,.2f}", styles['Normal']))
    elements.append(Spacer(1, 12))
    
    # Table Data
    table_data = [['Location', 'Drug', 'Clinical Use', 'Wastage', 'Wastage Value']]
    for row in report_data:
        table_data.append([
            row['location_name'],
            row['drug_name'],
            str(row['clinical_use']),
            str(row['wastage']),
            f"${row['wastage_value']:,.2f}"
        ])
    
    t = Table(table_data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    elements.append(t)
    
    doc.build(elements)
    
    return send_from_directory(STATIC_FOLDER, filename, as_attachment=True)

# 10. NOTIFICATION SYSTEM
def send_sms(to_number, body):
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_FROM_NUMBER')

    print(f"DEBUG: Twilio Config - SID: {'Set' if account_sid else 'Missing'}, Token: {'Set' if auth_token else 'Missing'}, From: {from_number}")

    if not all([account_sid, auth_token, from_number]):
        logging.info(f"--- SMS SIMULATION (Configure TWILIO env vars to send real SMS) ---\nTo: {to_number}\nBody: {body}\n--------------------------------")
        print("DEBUG: SMS Simulation Mode (Missing Env Vars)")
        return True

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=body,
            from_=from_number,
            to=to_number
        )
        logging.info(f"SMS sent successfully to {to_number}: {message.sid}")
        print(f"DEBUG: SMS Sent Successfully! SID: {message.sid}")
        return True
    except Exception as e:
        logging.error(f"Failed to send SMS: {e}")
        print(f"DEBUG: SMS FAILED: {str(e)}")
        return False

def send_email(to_email, subject, body):
    # Outlook / Office 365 SMTP Settings
    SMTP_SERVER = "smtp.office365.com"
    SMTP_PORT = 587
    
    # Try to get credentials from environment variables, or use placeholders
    SENDER_EMAIL = os.environ.get('SMTP_EMAIL', "your_email@funlhn.health")
    SENDER_PASSWORD = os.environ.get('SMTP_PASSWORD', "")
    
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = SENDER_EMAIL
    message["To"] = to_email
    
    message.attach(MIMEText(body, "plain"))
    
    try:
        if not SENDER_PASSWORD:
            # Fallback to logging if no password configured
            logging.info(f"--- EMAIL SIMULATION (Configure SMTP_PASSWORD to send real emails) ---\nTo: {to_email}\nSubject: {subject}\nBody:\n{body}\n--------------------------------")
            return True

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, message.as_string())
            
        logging.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email: {e}")
        return False

def send_low_stock_notification(stock_info):
    # Log it
    logging.info(f"LOW STOCK ALERT: {stock_info['drug_name']} at {stock_info['location_name']} - Only {stock_info['available_count']} remaining")
    
    receiver_email = "pharmacy.hub@funlhn.health"
    
    text = f"""\
    Low Stock Alert
    
    Drug: {stock_info['drug_name']}
    Location: {stock_info['location_name']}
    Remaining: {stock_info['available_count']}
    Min Level: {stock_info['min_stock']}
    
    Please replenish immediately.
    """
    
    send_email(receiver_email, f"LOW STOCK ALERT: {stock_info['drug_name']}", text)

# 11. SETTINGS
# 11. SETTINGS
@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    location_id = request.args.get('location_id')
    
    if request.method == 'GET':
        if not location_id:
             return jsonify({})
             
        with get_db() as conn:
            try:
                settings = conn.execute("SELECT * FROM settings WHERE location_id = ? LIMIT 1", (location_id,)).fetchone()
                if settings:
                    return jsonify(dict(settings))
                else:
                    return jsonify({})
            except sqlite3.OperationalError:
                return jsonify({})

    # POST - Save settings
    data = request.json
    printer_ip = data.get('printer_ip')
    printer_port = data.get('printer_port')
    label_width = data.get('label_width', 50)
    label_height = data.get('label_height', 25)
    margin_top = data.get('margin_top', 0)
    margin_right = data.get('margin_right', 0)
    location_id = data.get('location_id')

    if not location_id:
        return jsonify({"error": "Location ID required"}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        # Ensure table exists (migration for existing DBs)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location_id INTEGER,
                printer_ip TEXT,
                printer_port TEXT,
                label_width INTEGER DEFAULT 50,
                label_height INTEGER DEFAULT 25,
                margin_top INTEGER DEFAULT 0,
                margin_right INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Migration: Add columns if they don't exist (for existing DBs)
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN location_id INTEGER")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN label_width INTEGER DEFAULT 50")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN label_height INTEGER DEFAULT 25")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN margin_top INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN margin_right INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        
        # Check if row exists for this location
        existing = cursor.execute("SELECT id FROM settings WHERE location_id = ?", (location_id,)).fetchone()

        if existing:
            cursor.execute("""
                UPDATE settings 
                SET printer_ip = ?, printer_port = ?, label_width = ?, label_height = ?, margin_top = ?, margin_right = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (printer_ip, printer_port, label_width, label_height, margin_top, margin_right, existing['id']))
        else:
            cursor.execute("""
                INSERT INTO settings (location_id, printer_ip, printer_port, label_width, label_height, margin_top, margin_right)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (location_id, printer_ip, printer_port, label_width, label_height, margin_top, margin_right))
        
        conn.commit()
        return jsonify({"success": True})

@app.route('/api/generate_labels', methods=['POST'])
def generate_labels():
    data = request.json
    asset_ids = data.get('asset_ids', [])
    location_id = data.get('location_id')
    
    if not asset_ids:
        return jsonify({"error": "No assets provided"}), 400
        
    if not location_id:
        return jsonify({"error": "Location ID required"}), 400

    with get_db() as conn:
        # Get printer settings for this location
        settings = conn.execute("SELECT * FROM settings WHERE location_id = ? LIMIT 1", (location_id,)).fetchone()
        
        if not settings:
             return jsonify({"error": "Printer not configured for this location"}), 400

        # Convert to dict to use .get() safely
        settings_dict = dict(settings)
        
        if not settings_dict.get('printer_ip'):
            return jsonify({"error": "Printer IP not configured"}), 400
            
        printer_ip = settings_dict['printer_ip']
        printer_port = int(settings_dict['printer_port'] or 9100)
        
        # Calculate Offsets (203 DPI = 8 dots/mm)
        dpi = 8
        margin_top_mm = settings_dict.get('margin_top', 0) or 0
        margin_right_mm = settings_dict.get('margin_right', 0) or 0
        label_width_mm = settings_dict.get('label_width', 50) or 50
        
        # Top Offset
        top_offset_dots = int(margin_top_mm * dpi)
        
        # Left Offset calculation
        content_width_mm = 45
        
        # Calculate X position
        if margin_right_mm > 0:
            x_pos = int((label_width_mm - margin_right_mm - content_width_mm) * dpi)
            if x_pos < 0: x_pos = 0
        else:
            x_pos = 20 # Default left margin
            
        try:
            # Connect to printer
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(5) # 5 second timeout
                s.connect((printer_ip, printer_port))
                
                for asset_id in asset_ids:
                    # Get drug info for this asset
                    vial = conn.execute("""
                        SELECT v.*, d.name as drug_name, d.storage_temp 
                        FROM vials v
                        JOIN drugs d ON v.drug_id = d.id
                        WHERE v.asset_id = ?
                    """, (asset_id,)).fetchone()
                    
                    if vial:
                        # Generate ZPL
                        # Using calculated offsets and ^CI28 for UTF-8 support
                        zpl = f"""
                        ^XA
                        ^CI28
                        ^LH{x_pos},{top_offset_dots}
                        ^FO0,20^BQN,2,4^FDQA,{asset_id}^FS
                        ^FO120,20^A0N,30,30^FD{vial['drug_name'][:20]}^FS
                        ^FO120,55^A0N,25,25^FDExp: {vial['expiry_date']}^FS
                        ^FO120,85^A0N,25,25^FD{asset_id}^FS
                        ^FO120,115^A0N,20,20^FD{vial['storage_temp']}^FS
                        ^XZ
                        """
                        s.sendall(zpl.encode('utf-8'))
                        
            return jsonify({"success": True, "message": f"Sent {len(asset_ids)} labels to printer"})
            
        except Exception as e:
            logging.error(f"Printer error: {str(e)}")
            return jsonify({"error": f"Printer connection failed: {str(e)}"}), 500

# 12. HEARTBEAT & MONITORING
last_heartbeat = time.time()

def monitor():
    while True:
        time.sleep(5)
        # Increase timeout to 5 minutes (300 seconds) to prevent premature disconnects
        if time.time() - last_heartbeat > 300:
            logging.warning("Heartbeat timeout - shutting down")
            os._exit(0)

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return jsonify({"status": "alive", "timestamp": last_heartbeat})

# 13. SERVE REACT APP
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(STATIC_FOLDER, path)):
        return send_from_directory(STATIC_FOLDER, path)
    else:
        return send_from_directory(STATIC_FOLDER, 'index.html')

# STARTUP ROUTINE
def perform_backup():
    if os.path.exists(DB_FILE):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, f'backup_{timestamp}.dat')
        shutil.copy2(DB_FILE, backup_path)
        
        # Keep only last 7 backups
        backups = sorted(glob.glob(os.path.join(BACKUP_DIR, 'backup_*.dat')))
        if len(backups) > 7:
            for old_backup in backups[:-7]:
                os.remove(old_backup)

if __name__ == '__main__':

    
    # Initialize database
    init_db()
    
    # Perform backup
    perform_backup()
    
    # Start monitoring thread
    threading.Thread(target=monitor, daemon=True).start()
    
    # Find available port
    port = 5000
    for p in range(5000, 5100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', p)) != 0:
                port = p
                break
    
    print(f"Starting server on port {port}")
    logging.info(f"Starting server on port {port}")
    
    # Open browser
    import webbrowser
    webbrowser.open(f"http://127.0.0.1:{port}")

    # Close splash screen if it exists (PyInstaller)
    try:
        import pyi_splash
        pyi_splash.update_text('Starting server...')
        pyi_splash.close()
    except ImportError:
        pass
    
    # Run Flask app
    app.run(host='127.0.0.1', port=port, debug=False)
