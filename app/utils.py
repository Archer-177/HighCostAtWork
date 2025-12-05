import queue
import threading
import logging
import os
import time
import shutil
import glob
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from twilio.rest import Client
from .config import LOG_FILE, DB_FILE, BACKUP_DIR
import socket
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

# Configure logging
logging.basicConfig(filename=LOG_FILE, level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

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

# Start worker thread
threading.Thread(target=worker, daemon=True).start()

def queue_write(func, *args):
    q = queue.Queue()
    write_queue.put((func, args, q))
    res = q.get()
    if isinstance(res, Exception):
        raise res
    return res

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

# 12. HEARTBEAT & MONITORING
last_heartbeat = time.time()

def monitor():
    while True:
        time.sleep(5)
        # Increase timeout to 60 minutes (3600 seconds)
        if time.time() - last_heartbeat > 3600:
            logging.warning("Heartbeat timeout - shutting down")
            os._exit(0)

def update_heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return last_heartbeat

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

def get_stock_status_color(days_until_expiry):
    """
    Determines the status color based on days until expiry.
    <= 30 days: Red (Critical)
    <= 90 days: Amber (Warning)
    > 90 days: Green (Healthy)
    """
    if days_until_expiry is None:
        return 'green' # Default to healthy if unknown
        
    if days_until_expiry <= 30:
        return 'red'
    elif days_until_expiry <= 90:
        return 'amber'
    else:
        return 'green'

def print_zpl(printer_ip, printer_port, zpl_data):
    """
    Sends ZPL data to a network printer.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((printer_ip, printer_port))
            s.sendall(zpl_data.encode('utf-8'))
        return True, "Success"
    except Exception as e:
        logging.error(f"Printer error: {str(e)}")
        return False, str(e)

def generate_usage_pdf(filepath, report_data, stats):
    """
    Generates a PDF usage report using ReportLab.
    """
    try:
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
        return True
    except Exception as e:
        logging.error(f"PDF Generation error: {str(e)}")
        return False
