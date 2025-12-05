from flask import Flask
from flask_cors import CORS
from .config import STATIC_FOLDER
from .database import init_db
from .utils import perform_backup

def create_app():
    app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='/')
    CORS(app)
    
    # Initialize DB
    init_db()
    
    # Perform Backup
    perform_backup()
    
    # Register Blueprints
    from .routes import auth, inventory, transfers, reports, settings, core
    app.register_blueprint(auth.bp)
    app.register_blueprint(inventory.bp)
    app.register_blueprint(transfers.bp)
    app.register_blueprint(reports.bp)
    app.register_blueprint(settings.bp)
    app.register_blueprint(core.bp)
    
    return app
