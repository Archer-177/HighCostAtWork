
# 12. STOCK JOURNEY & SEARCH
@app.route('/api/stock_search', methods=['GET'])
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

@app.route('/api/stock_journey/<asset_id>', methods=['GET'])
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
                u.username as user_name
            FROM transfer_items ti
            JOIN transfers t ON ti.transfer_id = t.id
            JOIN locations fl ON t.from_location_id = fl.id
            JOIN locations tl ON t.to_location_id = tl.id
            JOIN users u ON t.created_by = u.id
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
                    'user': 'System', # Or approver if available
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
