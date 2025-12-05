import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# PATH SETUP (Frozen vs Script)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    # Search for app_static in common locations
    possible_paths = [
        os.path.join(sys._MEIPASS, 'app_static'),
        os.path.join(BASE_DIR, '_internal', 'app_static'),
        os.path.join(BASE_DIR, 'app_static'),
    ]
    
    STATIC_FOLDER = None
    for path in possible_paths:
        if os.path.exists(path):
            STATIC_FOLDER = path
            break
            
    if STATIC_FOLDER is None:
        # Fallback
        STATIC_FOLDER = possible_paths[0]
    
    # DEBUG LOGGING (Force flush)
    with open(os.path.join(BASE_DIR, 'path_debug.txt'), 'w') as f:
        f.write(f"Executable: {sys.executable}\n")
        f.write(f"MEIPASS: {getattr(sys, '_MEIPASS', 'Not Set')}\n")
        f.write(f"Resolved STATIC_FOLDER: {STATIC_FOLDER}\n")
        f.write(f"Exists: {os.path.exists(STATIC_FOLDER)}\n")
else:
    # app/config.py -> app/ -> root
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    STATIC_FOLDER = os.path.join(BASE_DIR, 'frontend', 'build')

DB_FILE = os.path.join(BASE_DIR, 'sys_data.dat')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LOG_FILE = os.path.join(BASE_DIR, 'debug_log.txt')

# Ensure backup directory exists
os.makedirs(BACKUP_DIR, exist_ok=True)
