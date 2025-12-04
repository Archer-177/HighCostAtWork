from flask import Blueprint, request, jsonify
import time
import json
import uuid
from datetime import datetime, timedelta
from ..database import get_db
from ..utils import queue_write, send_low_stock_notification, get_stock_status_color

bp = Blueprint('stock', __name__)

# 5. STOCK OPERATIONS
def receive_stock_logic(drug_id, batch_number, expiry_date, quantity, location_id, user_id, goods_receipt_number=None):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get drug info
        drug = cursor.execute("SELECT * FROM drugs WHERE id = ?", (drug_id,)).fetchone()
        if not drug:
            return {"error": "Drug not found"}, 404
        
        # Generate unique asset IDs
        timestamp = int(time.time())
        asset_ids = []
        for i in range(quantity):
            # Format: DRUG-LOC-TIMESTAMP-SEQ
            asset_id = f"{drug['name'][:3].upper()}-{location_id}-{timestamp}-{i+1}"
            
            cursor.execute("""
                INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status, goods_receipt_number, created_at)
                VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
            """, (asset_id, drug_id, batch_number, expiry_date, location_id, goods_receipt_number, datetime.now()))
            asset_ids.append(asset_id)
            
            # Log action
            cursor.execute("""
                INSERT INTO audit_log (user_id, action, details, timestamp)
                VALUES (?, ?, ?, ?)
            """, (user_id, 'RECEIVE_STOCK', json.dumps({
                'asset_id': asset_id,
                'location_id': location_id,
                'goods_receipt_number': goods_receipt_number
            }), datetime.now()))
        
        conn.commit()
        
        return {
            "success": True,
            "asset_ids": asset_ids,
            "drug_name": drug['name'],
            "total_value": drug['unit_price'] * quantity
        }, 200

@bp.route('/api/receive_stock', methods=['POST'])
def receive_stock():
    data = request.json
    result, status = queue_write(
        receive_stock_logic,
        data['drug_id'],
        data['batch_number'],
        data['expiry_date'],
        data['quantity'],
        data['location_id'],
        data['user_id'],
        data.get('goods_receipt_number')
    )
    return jsonify(result), status

# 6. USE/DISCARD STOCK
def use_stock_logic(vial_id, user_id, action, discard_reason=None, user_version=None, patient_mrn=None, clinical_notes=None, disposal_register_number=None):
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
            SET status = ?, used_at = ?, used_by = ?, 
                discard_reason = ?, patient_mrn = ?, clinical_notes = ?, 
                disposal_register_number = ?, version = version + 1
            WHERE id = ?
        """, (new_status, datetime.now(), user_id, discard_reason, patient_mrn, clinical_notes, disposal_register_number, vial_id))
        
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
            INSERT INTO audit_log (user_id, action, details, timestamp)
            VALUES (?, ?, ?, ?)
        """, (user_id, action + '_STOCK', json.dumps({
            'asset_id': vial['asset_id'],
            'drug_id': vial['drug_id'],
            'discard_reason': discard_reason,
            'disposal_register_number': disposal_register_number
        }), datetime.now()))
        
        conn.commit()
        
        # Check if notification needed
        needs_notification = stock_info and stock_info['min_stock'] and stock_info['available_count'] < stock_info['min_stock']
        
        return {
            "success": True,
            "needs_notification": needs_notification,
            "stock_info": dict(stock_info) if stock_info else None
        }, 200

@bp.route('/api/use_stock', methods=['POST'])
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
            INSERT INTO transfers (from_location_id, to_location_id, created_by, status, completed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (from_location_id, to_location_id, created_by, status, datetime.now() if is_immediate else None, datetime.now()))
        
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

@bp.route('/api/create_transfer', methods=['POST'])
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
@bp.route('/api/dashboard/<int:user_id>', methods=['GET'])
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
            stock_dict['status_color'] = get_stock_status_color(stock_dict['days_until_expiry'])
            stock_list.append(stock_dict)
        
        return jsonify({
            'user': dict(user),
            'stock': stock_list,
            'stats': stats
        })

@bp.route('/api/locations/<int:location_id>', methods=['DELETE'])
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

@bp.route('/api/locations', methods=['GET', 'POST'])
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
            INSERT INTO locations (name, type, parent_hub_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data['name'], data['type'], data.get('parent_hub_id'), datetime.now()))
        conn.commit()
        return jsonify({"success": True, "id": cursor.lastrowid})

@bp.route('/api/drugs', methods=['GET', 'POST'])
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
            INSERT INTO drugs (name, category, storage_temp, unit_price, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (data['name'], data['category'], data['storage_temp'], data['unit_price'], datetime.now()))
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

@bp.route('/api/stock/<int:location_id>', methods=['GET'])
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

@bp.route('/api/stock/all', methods=['GET'])
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

@bp.route('/api/transfers/<int:location_id>', methods=['GET'])
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
                item_dict['status_color'] = get_stock_status_color(days)
                processed_items.append(item_dict)
            
            t_dict['items'] = processed_items
            transfer_list.append(t_dict)
            
        return jsonify(transfer_list)

def handle_transfer_action_logic(transfer_id, action, user_id, user_version):
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
                SET status = 'IN_TRANSIT', approved_by = ?, approved_at = ?, version = version + 1
                WHERE id = ? AND status = 'PENDING'
            """, (user_id, datetime.now(), transfer_id))
            
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
                SET status = 'COMPLETED', completed_at = ?, completed_by = ?, version = version + 1
                WHERE id = ? AND status = 'IN_TRANSIT'
            """, (datetime.now(), user_id, transfer_id))
            
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

@bp.route('/api/transfer/<int:transfer_id>/<string:action>', methods=['POST'])
def handle_transfer_action(transfer_id, action):
    data = request.json
    result, status = queue_write(
        handle_transfer_action_logic,
        transfer_id,
        action,
        data.get('user_id'),
        data.get('version')
    )
    return jsonify(result), status

@bp.route('/api/stock_search', methods=['GET'])
def stock_search():
    query = request.args.get('query', '').strip()
    status = request.args.get('status', 'ALL')
    
    if not query and status == 'ALL':
        return jsonify([])

    with get_db() as conn:
        sql = """
            SELECT 
                v.*, 
                d.name as drug_name, 
                d.category,
                l.name as location_name,
                l.type as location_type
            FROM vials v
            JOIN drugs d ON v.drug_id = d.id
            JOIN locations l ON v.location_id = l.id
            WHERE 1=1
        """
        params = []
        
        if query:
            sql += """ AND (
                v.asset_id LIKE ? OR 
                v.batch_number LIKE ? OR 
                d.name LIKE ?
            )"""
            search_term = f"%{query}%"
            params.extend([search_term, search_term, search_term])
            
        if status != 'ALL':
            sql += " AND v.status = ?"
            params.append(status)
            
        sql += " ORDER BY v.created_at DESC LIMIT 50"
        
        results = conn.execute(sql, params).fetchall()
        return jsonify([dict(r) for r in results])

@bp.route('/api/stock_journey/<asset_id>', methods=['GET'])
def stock_journey(asset_id):
    with get_db() as conn:
        # 1. Get Vial Details
        vial = conn.execute("""
            SELECT 
                v.*, 
                d.name as drug_name, 
                d.category,
                d.storage_temp,
                l.name as location_name,
                l.type as location_type,
                u.username as created_by_username
            FROM vials v
            JOIN drugs d ON v.drug_id = d.id
            JOIN locations l ON v.location_id = l.id
            LEFT JOIN users u ON u.id = (
                SELECT user_id FROM audit_log 
                WHERE action = 'RECEIVE_STOCK' 
                AND details LIKE ? 
                LIMIT 1
            )
            WHERE v.asset_id = ?
        """, (f"%{asset_id}%", asset_id)).fetchone()
        
        if not vial:
            return jsonify({"error": "Asset not found"}), 404
            
        timeline = []
        
        # 2. Add Creation/Receipt Event
        timeline.append({
            'type': 'CREATED',
            'timestamp': vial['created_at'],
            'title': 'Stock Received',
            'location': vial['location_name'],
            'user': vial['created_by_username'] or 'System',
            'details': {
                'Batch': vial['batch_number'],
                'Expiry': vial['expiry_date'],
                'Goods Receipt': vial['goods_receipt_number']
            }
        })
        
        # 3. Add Transfers
        transfers = conn.execute("""
            SELECT 
                t.*,
                fl.name as from_name,
                tl.name as to_name,
                u.username as user_name,
                cu.username as completed_by_name
            FROM transfer_items ti
            JOIN transfers t ON ti.transfer_id = t.id
            JOIN locations fl ON t.from_location_id = fl.id
            JOIN locations tl ON t.to_location_id = tl.id
            JOIN users u ON t.created_by = u.id
            LEFT JOIN users cu ON t.completed_by = cu.id
            JOIN vials v ON ti.vial_id = v.id
            WHERE v.asset_id = ?
            ORDER BY t.created_at
        """, (asset_id,)).fetchall()
        
        for t in transfers:
            timeline.append({
                'type': 'TRANSFER_STARTED',
                'timestamp': t['created_at'],
                'title': 'Transfer Initiated',
                'location': t['from_name'],
                'user': t['user_name'],
                'details': {
                    'Destination': t['to_name'],
                    'Status': t['status']
                }
            })
            
            if t['completed_at']:
                timeline.append({
                    'type': 'TRANSFER_COMPLETED',
                    'timestamp': t['completed_at'],
                    'title': 'Transfer Completed',
                    'location': t['to_name'],
                    'user': t['completed_by_name'] or 'System',
                    'details': {
                        'Source': t['from_name']
                    }
                })

        # 4. Add Usage/Disposal
        if vial['status'] == 'USED_CLINICAL':
            user = conn.execute("SELECT username FROM users WHERE id = ?", (vial['used_by'],)).fetchone()
            timeline.append({
                'type': 'USED',
                'timestamp': vial['used_at'],
                'title': 'Clinical Use',
                'location': vial['location_name'], # Current location
                'user': user['username'] if user else 'Unknown',
                'details': {
                    'Patient MRN': vial['patient_mrn'],
                    'Notes': vial['clinical_notes']
                }
            })
        elif vial['status'] == 'DISCARDED':
            user = conn.execute("SELECT username FROM users WHERE id = ?", (vial['used_by'],)).fetchone()
            timeline.append({
                'type': 'DISCARDED',
                'timestamp': vial['used_at'],
                'title': 'Stock Discarded',
                'location': vial['location_name'],
                'user': user['username'] if user else 'Unknown',
                'details': {
                    'Reason': vial['discard_reason'],
                    'Register #': vial['disposal_register_number']
                }
            })
            
        # Sort by timestamp
        timeline.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'vial': dict(vial),
            'timeline': timeline
        })
