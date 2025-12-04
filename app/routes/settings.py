from flask import Blueprint, request, jsonify
import socket
import logging
from ..database import get_db

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

@bp.route('/api/generate_labels', methods=['POST'])
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
