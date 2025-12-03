"""
Main Flask Application
Clean, modular structure with blueprints
Network-drive compatible with multi-user support
"""
import os
import sys
import time
import threading
import queue
import socket
import shutil
import glob
import webbrowser
import logging
from datetime import datetime
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from models.database import get_engine, init_database, get_session
from utils.helpers import find_available_port, setup_logger

# Load environment variables
load_dotenv()

# ============================================================================
# PATH SETUP (PyInstaller compatible)
# ============================================================================
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_DIR = os.path.dirname(sys.executable)
    STATIC_FOLDER = os.path.join(sys._MEIPASS, 'build')
else:
    # Running as script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_FOLDER = os.path.join(BASE_DIR, '..', 'frontend-v2', 'dist')

DB_FILE = os.path.join(BASE_DIR, 'sys_data.db')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LOG_FILE = os.path.join(BASE_DIR, 'app.log')

# Create necessary directories
os.makedirs(BACKUP_DIR, exist_ok=True)

# Setup logging
logger = setup_logger('medicine_tracker', LOG_FILE, logging.INFO)

# ============================================================================
# WRITE QUEUE FOR CONCURRENCY SAFETY
# ============================================================================
write_queue = queue.Queue()

def write_worker():
    """Background worker for all write operations"""
    while True:
        func, args, result_queue = write_queue.get()
        try:
            result = func(*args)
            result_queue.put(('success', result))
        except Exception as e:
            logger.error(f"Write operation failed: {str(e)}", exc_info=True)
            result_queue.put(('error', e))
        finally:
            write_queue.task_done()

def queue_write(func, *args):
    """
    Queue a write operation to be executed serially

    This ensures that SQLite write operations don't conflict
    when multiple users are accessing the database from a network drive
    """
    result_queue = queue.Queue()
    write_queue.put((func, args, result_queue))
    status, result = result_queue.get()

    if status == 'error':
        raise result
    return result

# Start write worker thread
threading.Thread(target=write_worker, daemon=True).start()

# ============================================================================
# CREATE FLASK APP
# ============================================================================
def create_app():
    """Application factory pattern"""
    app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='/')

    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JSON_SORT_KEYS'] = False
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_FILE}'

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Database setup
    engine = get_engine(DB_FILE)

    # Initialize database if needed
    if not os.path.exists(DB_FILE):
        logger.info("Creating new database...")
        init_database(engine)

        # Seed initial data
        from models.database import seed_initial_data
        session = get_session(engine)
        seed_initial_data(session)
        session.close()
        logger.info("Database initialized successfully")

    # Attach database engine to app
    app.engine = engine

    # Register blueprints (routes)
    from routes import auth, stock, transfers, admin, reports

    app.register_blueprint(auth.bp, url_prefix='/api')
    app.register_blueprint(stock.bp, url_prefix='/api')
    app.register_blueprint(transfers.bp, url_prefix='/api')
    app.register_blueprint(admin.bp, url_prefix='/api')
    app.register_blueprint(reports.bp, url_prefix='/api')

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return {'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}

    # Serve React app
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path and os.path.exists(os.path.join(STATIC_FOLDER, path)):
            return send_from_directory(STATIC_FOLDER, path)
        return send_from_directory(STATIC_FOLDER, 'index.html')

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'success': False, 'error': 'Resource not found'}, 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {str(error)}", exc_info=True)
        return {'success': False, 'error': 'Internal server error'}, 500

    return app

# ============================================================================
# HEARTBEAT MONITORING
# ============================================================================
last_heartbeat = time.time()

def heartbeat_monitor():
    """Monitor heartbeat and shutdown if client disconnects"""
    global last_heartbeat

    # Timeout: 5 minutes of inactivity
    TIMEOUT = 300

    while True:
        time.sleep(5)
        if time.time() - last_heartbeat > TIMEOUT:
            logger.warning("Heartbeat timeout - shutting down server")
            os._exit(0)

@create_app().route('/api/heartbeat', methods=['POST'])
def heartbeat():
    """Heartbeat endpoint - keeps server alive"""
    global last_heartbeat
    last_heartbeat = time.time()
    return {'status': 'alive', 'timestamp': last_heartbeat}

# ============================================================================
# BACKUP SYSTEM
# ============================================================================
def perform_backup():
    """Create rolling backup of database"""
    if os.path.exists(DB_FILE):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, f'backup_{timestamp}.db')

        try:
            shutil.copy2(DB_FILE, backup_path)
            logger.info(f"Backup created: {backup_path}")

            # Keep only last 7 backups
            backups = sorted(glob.glob(os.path.join(BACKUP_DIR, 'backup_*.db')))
            if len(backups) > 7:
                for old_backup in backups[:-7]:
                    os.remove(old_backup)
                    logger.info(f"Removed old backup: {old_backup}")

        except Exception as e:
            logger.error(f"Backup failed: {str(e)}")

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
def main():
    """Main entry point for the application"""

    logger.info("=" * 60)
    logger.info("FUNLHN Medicine Tracker v2.0")
    logger.info("=" * 60)

    # Create backup on startup
    logger.info("Creating database backup...")
    perform_backup()

    # Create Flask app
    app = create_app()

    # Start heartbeat monitor
    logger.info("Starting heartbeat monitor...")
    threading.Thread(target=heartbeat_monitor, daemon=True).start()

    # Find available port
    try:
        port = find_available_port()
        logger.info(f"Found available port: {port}")
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    # Open browser
    url = f"http://127.0.0.1:{port}"
    logger.info(f"Opening browser: {url}")
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    # Close PyInstaller splash screen if exists
    try:
        import pyi_splash
        pyi_splash.update_text('Starting server...')
        pyi_splash.close()
    except ImportError:
        pass

    # Run Flask app
    logger.info(f"Starting Flask server on {url}")
    logger.info("Press Ctrl+C to shutdown")
    logger.info("=" * 60)

    app.run(
        host='127.0.0.1',
        port=port,
        debug=False,
        threaded=True,
        use_reloader=False
    )


if __name__ == '__main__':
    main()
