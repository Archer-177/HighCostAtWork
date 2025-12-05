import sqlite3
import uuid
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from .config import DB_FILE, BASE_DIR

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA journal_mode = DELETE")
    conn.execute("PRAGMA synchronous = FULL")
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()

        # Schema versioning table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS _schema_version (
                version INTEGER PRIMARY KEY
            )
        ''')
        
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
                must_change_password BOOLEAN DEFAULT 0,
                reset_token TEXT,
                reset_token_expiry TIMESTAMP,
                mobile_number TEXT,
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
                goods_receipt_number TEXT,
                disposal_register_number TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP,
                used_by INTEGER,
                version INTEGER DEFAULT 1,
                FOREIGN KEY (drug_id) REFERENCES drugs(id),
                FOREIGN KEY (location_id) REFERENCES locations(id),
                FOREIGN KEY (used_by) REFERENCES users(id)
            )
        ''')
        
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
                completed_by INTEGER,
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
                label_width INTEGER,
                label_height INTEGER,
                margin_top INTEGER,
                margin_right INTEGER,
                location_id INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Get current version
        cursor.execute("SELECT version FROM _schema_version")
        current_version = cursor.fetchone()
        if current_version is None:
            cursor.execute("INSERT INTO _schema_version (version) VALUES (1)")
            current_version = (1,)
            conn.commit()

        # Migrations
        if current_version[0] < 2:
            try: cursor.execute("ALTER TABLE vials ADD COLUMN patient_mrn TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE vials ADD COLUMN clinical_notes TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE transfers ADD COLUMN completed_by INTEGER REFERENCES users(id)")
            except: pass
            try: cursor.execute("ALTER TABLE users ADD COLUMN is_supervisor BOOLEAN DEFAULT 0")
            except: pass
            try: cursor.execute("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0")
            except: pass
            try: cursor.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP")
            except: pass
            try: cursor.execute("ALTER TABLE users ADD COLUMN mobile_number TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE vials ADD COLUMN goods_receipt_number TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE vials ADD COLUMN disposal_register_number TEXT")
            except: pass
            try: cursor.execute("ALTER TABLE settings ADD COLUMN label_width INTEGER")
            except: pass
            try: cursor.execute("ALTER TABLE settings ADD COLUMN label_height INTEGER")
            except: pass
            try: cursor.execute("ALTER TABLE settings ADD COLUMN margin_top INTEGER")
            except: pass
            try: cursor.execute("ALTER TABLE settings ADD COLUMN margin_right INTEGER")
            except: pass
            try: cursor.execute("ALTER TABLE settings ADD COLUMN location_id INTEGER")
            except: pass

            cursor.execute("UPDATE _schema_version SET version = 2")
            conn.commit()

        # Insert initial data if empty
        cursor.execute("SELECT COUNT(*) FROM locations")
        if cursor.fetchone()[0] == 0:
            import json
            import os
            
            # Try to load from seed_data.json in BASE_DIR (root)
            seed_file = os.path.join(BASE_DIR, 'seed_data.json')
            data = None
            
            if os.path.exists(seed_file):
                try:
                    with open(seed_file, 'r') as f:
                        data = json.load(f)
                        print(f"Loading seed data from {seed_file}")
                except Exception as e:
                    print(f"Error loading seed data: {e}")
            
            if not data:
                print("Using hardcoded fallback seed data")
                data = {
                    "locations": [
                        { "name": "Port Augusta Hospital Pharmacy", "type": "HUB" },
                        { "name": "Whyalla Hospital Pharmacy", "type": "HUB" },
                        { "name": "Port Augusta ED", "type": "WARD", "parent_hub": "Port Augusta Hospital Pharmacy" },
                        { "name": "Whyalla HDU", "type": "WARD", "parent_hub": "Whyalla Hospital Pharmacy" },
                        { "name": "Whyalla ED", "type": "WARD", "parent_hub": "Whyalla Hospital Pharmacy" },
                        { "name": "Roxby Downs", "type": "REMOTE", "parent_hub": "Port Augusta Hospital Pharmacy" },
                        { "name": "Quorn", "type": "REMOTE", "parent_hub": "Port Augusta Hospital Pharmacy" },
                        { "name": "Hawker", "type": "REMOTE", "parent_hub": "Port Augusta Hospital Pharmacy" },
                        { "name": "Leigh Creek", "type": "REMOTE", "parent_hub": "Port Augusta Hospital Pharmacy" },
                        { "name": "Oodnadatta", "type": "REMOTE", "parent_hub": "Port Augusta Hospital Pharmacy" }
                    ],
                    "drugs": [
                        { "name": "Tenecteplase", "category": "Thrombolytic", "storage_temp": "<25°C", "unit_price": 2500.00 },
                        { "name": "Red Back Spider Antivenom", "category": "Antivenom", "storage_temp": "2-8°C", "unit_price": 850.00 },
                        { "name": "Brown Snake Antivenom", "category": "Antivenom", "storage_temp": "2-8°C", "unit_price": 1200.00 }
                    ],
                    "users": [
                        {
                            "username": "admin",
                            "password": "admin123",
                            "role": "PHARMACIST",
                            "location": "Port Augusta Hospital Pharmacy",
                            "can_delegate": True,
                            "is_supervisor": True,
                            "email": "admin@funlhn.health"
                        }
                    ]
                }

            # Process Locations
            # First pass: Create all locations
            loc_map = {} # name -> id
            for loc in data['locations']:
                cursor.execute("INSERT INTO locations (name, type) VALUES (?, ?)", (loc['name'], loc['type']))
                loc_map[loc['name']] = cursor.lastrowid
            
            # Second pass: Update parent_hub_ids
            for loc in data['locations']:
                if 'parent_hub' in loc:
                    parent_id = loc_map.get(loc['parent_hub'])
                    if parent_id:
                        cursor.execute("UPDATE locations SET parent_hub_id = ? WHERE id = ?", (parent_id, loc_map[loc['name']]))

            # Process Drugs
            for drug in data['drugs']:
                cursor.execute("""
                    INSERT INTO drugs (name, category, storage_temp, unit_price) 
                    VALUES (?, ?, ?, ?)
                """, (drug['name'], drug['category'], drug['storage_temp'], drug['unit_price']))

            # Process Users
            for user in data['users']:
                loc_id = loc_map.get(user['location'])
                if loc_id:
                    cursor.execute("""
                        INSERT INTO users (username, password_hash, role, location_id, can_delegate, is_supervisor, email) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (user['username'], generate_password_hash(user['password']), user['role'], loc_id, 
                          1 if user.get('can_delegate') else 0, 
                          1 if user.get('is_supervisor') else 0, 
                          user.get('email')))

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