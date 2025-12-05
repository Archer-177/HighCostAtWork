from flask import Blueprint, request, jsonify
import logging
from ..database import get_db
from ..utils import print_zpl, queue_write
from ..schemas import SettingsRequest, CreateLocationRequest, UpdateLocationRequest, CreateDrugRequest, UpdateStockLevelsRequest
from pydantic import ValidationError
from datetime import datetime

bp = Blueprint('settings', __name__)

# 11. SETTINGS
@bp.route('/api/settings', methods=['GET', 'POST'])
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
            except Exception:
                return jsonify({})

    # POST - Save settings
    try:
        data = SettingsRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

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
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN label_width INTEGER DEFAULT 50")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN label_height INTEGER DEFAULT 25")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN margin_top INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE settings ADD COLUMN margin_right INTEGER DEFAULT 0")
        except Exception:
            pass
        
        # Check if row exists for this location
        existing = cursor.execute("SELECT id FROM settings WHERE location_id = ?", (data.location_id,)).fetchone()

        if existing:
            cursor.execute("""
                UPDATE settings 
                SET printer_ip = ?, printer_port = ?, label_width = ?, label_height = ?, margin_top = ?, margin_right = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (data.printer_ip, data.printer_port, data.label_width, data.label_height, data.margin_top, data.margin_right, existing['id']))
        else:
            cursor.execute("""
                INSERT INTO settings (location_id, printer_ip, printer_port, label_width, label_height, margin_top, margin_right)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (data.location_id, data.printer_ip, data.printer_port, data.label_width, data.label_height, data.margin_top, data.margin_right))
        
        conn.commit()
        return jsonify({"success": True})

@bp.route('/api/locations/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    user_version = request.args.get('version', type=int)
    with get_db() as conn:
        cursor = conn.cursor()

        # Optimistic Locking Check
        location = cursor.execute("SELECT * FROM locations WHERE id = ?", (location_id,)).fetchone()
        if not location:
            return jsonify({"error": "Location not found"}), 404
        
        if user_version is not None and location['version'] != user_version:
            return jsonify({"error": "Data has changed. Please refresh."}), 409

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

@bp.route('/api/locations', methods=['GET', 'POST'])
def handle_locations():
    if request.method == 'GET':
        with get_db() as conn:
            locations = conn.execute("SELECT * FROM locations ORDER BY type, name").fetchall()
            return jsonify([dict(location) for location in locations])
    
    # POST - Create new location
    try:
        data = CreateLocationRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO locations (name, type, parent_hub_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data.name, data.type, data.parent_hub_id, datetime.now()))
        conn.commit()
        return jsonify({"success": True, "id": cursor.lastrowid})


@bp.route('/api/locations/<int:location_id>', methods=['PUT'])
def update_location(location_id):
    try:
        data = UpdateLocationRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        cursor = conn.cursor()

        # Optimistic Locking Check
        location = cursor.execute("SELECT * FROM locations WHERE id = ?", (location_id,)).fetchone()
        if not location:
            return jsonify({"error": "Location not found"}), 404
        
        if data.version is not None and location['version'] != data.version:
            return jsonify({"error": "Data has changed. Please refresh."}), 409

        cursor.execute("""
            UPDATE locations
            SET name = ?, type = ?, parent_hub_id = ?, version = version + 1
            WHERE id = ?
        """, (data.name, data.type, data.parent_hub_id, location_id))
        
        conn.commit()
        return jsonify({"success": True})

@bp.route('/api/drugs', methods=['GET', 'POST'])
def handle_drugs():
    if request.method == 'GET':
        with get_db() as conn:
            drugs = conn.execute("SELECT * FROM drugs ORDER BY name").fetchall()
            return jsonify([dict(drug) for drug in drugs])

    # POST - Create new drug
    try:
        data = CreateDrugRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drugs (name, category, storage_temp, unit_price, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (data.name, data.category, data.storage_temp, data.unit_price, datetime.now()))
        conn.commit()
        return jsonify({"success": True, "id": cursor.lastrowid})

@bp.route('/api/stock_levels', methods=['GET', 'PUT'])
def handle_stock_levels():
    if request.method == 'GET':
        with get_db() as conn:
            levels = conn.execute("""
                SELECT * FROM stock_levels ORDER BY location_id, drug_id
            """).fetchall()
            return jsonify([dict(level) for level in levels])
    
    # PUT - Update multiple stock levels
    try:
        data = UpdateStockLevelsRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422
    
        try:
            cursor.execute("ALTER TABLE stock_levels ADD COLUMN version INTEGER DEFAULT 1")
        except Exception:
            pass

    def update_logic():
        with get_db() as conn:
            cursor = conn.cursor()
            for update in data.updates:
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
                        SET min_stock = ?, version = version + 1
                        WHERE location_id = ? AND drug_id = ?
                    """, (min_stock, location_id, drug_id))
                else:
                    cursor.execute("""
                        INSERT INTO stock_levels (location_id, drug_id, min_stock, version)
                        VALUES (?, ?, ?, 1)
                    """, (location_id, drug_id, min_stock))
            
            conn.commit()
            return {"success": True}, 200
    
    result, status = queue_write(update_logic)
    return jsonify(result), status
