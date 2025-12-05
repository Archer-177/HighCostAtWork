from flask import Blueprint, request, jsonify, send_from_directory
from datetime import datetime, timedelta
import os
from ..database import get_db
from ..config import STATIC_FOLDER
from ..utils import generate_usage_pdf

bp = Blueprint('reports', __name__)

# 9. REPORTS
@bp.route('/api/reports/usage', methods=['GET'])
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

@bp.route('/api/reports/export_pdf', methods=['POST'])
def export_pdf():
    data = request.json
    report_data = data.get('report_data', [])
    stats = data.get('stats', {})
    
    filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(STATIC_FOLDER, filename)
    
    if generate_usage_pdf(filepath, report_data, stats):
        return send_from_directory(STATIC_FOLDER, filename, as_attachment=True)
    else:
        return jsonify({"error": "Failed to generate PDF"}), 500
    
    # Unreachable code removed
