from flask import Blueprint, request, jsonify
from datetime import datetime
from ..database import get_db
from ..utils import queue_write
from ..schemas import CreateTransferRequest, TransferActionRequest
from pydantic import ValidationError

bp = Blueprint('transfers', __name__)

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
    try:
        data = CreateTransferRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    result, status = queue_write(
        create_transfer_logic,
        data.from_location_id,
        data.to_location_id,
        data.vial_ids,
        data.created_by
    )
    return jsonify(result), status

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
                u.username as created_by_name,
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
        
        transfer_list = []
        for t in transfers:
            t_dict = dict(t)
            items = conn.execute("""
                SELECT 
                    v.id, v.asset_id, d.name as drug_name, v.batch_number, v.expiry_date
                FROM transfer_items ti
                JOIN vials v ON ti.vial_id = v.id
                JOIN drugs d ON v.drug_id = d.id
                WHERE ti.transfer_id = ?
            """, (t['id'],)).fetchall()
            t_dict['items'] = [dict(item) for item in items]
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
            cursor.execute("""
                UPDATE transfers 
                SET status = 'IN_TRANSIT', approved_by = ?, approved_at = ?, version = version + 1
                WHERE id = ? AND status = 'PENDING'
            """, (user_id, datetime.now(), transfer_id))
            
            if cursor.rowcount == 0:
                return {"error": "Transfer is not in PENDING state or has already been modified"}, 400

            cursor.execute("""
                UPDATE vials 
                SET status = 'IN_TRANSIT', version = version + 1
                WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
            """, (transfer_id,))
            
        elif action == 'complete':
            cursor.execute("""
                UPDATE transfers 
                SET status = 'COMPLETED', completed_at = ?, completed_by = ?, version = version + 1
                WHERE id = ? AND status = 'IN_TRANSIT'
            """, (datetime.now(), user_id, transfer_id))
            
            if cursor.rowcount == 0:
                return {"error": "Transfer is not in IN_TRANSIT state or has already been modified"}, 400
            
            cursor.execute("""
                UPDATE vials 
                SET status = 'AVAILABLE', location_id = ?, version = version + 1
                WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
            """, (transfer['to_location_id'], transfer_id))
            
        elif action == 'cancel':
            cursor.execute("""
                UPDATE transfers 
                SET status = 'CANCELLED', version = version + 1
                WHERE id = ? AND status = 'PENDING'
            """, (transfer_id,))
            
            if cursor.rowcount == 0:
                return {"error": "Transfer is not in PENDING state or has already been modified"}, 400
            
            cursor.execute("""
                UPDATE vials 
                SET status = 'AVAILABLE', version = version + 1
                WHERE id IN (SELECT vial_id FROM transfer_items WHERE transfer_id = ?)
            """, (transfer_id,))
        
        conn.commit()
        return {"success": True}, 200

@bp.route('/api/transfer/<int:transfer_id>/<string:action>', methods=['POST'])
def handle_transfer_action(transfer_id, action):
    try:
        data = TransferActionRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    result, status = queue_write(
        handle_transfer_action_logic,
        transfer_id,
        action,
        data.user_id,
        data.version
    )
    return jsonify(result), status