from flask import Blueprint, request, jsonify, send_from_directory
from datetime import datetime, timedelta
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from ..database import get_db
from ..config import STATIC_FOLDER

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
