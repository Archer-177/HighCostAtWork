import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# PATH SETUP (Frozen vs Script)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    STATIC_FOLDER = os.path.join(sys._MEIPASS, 'build')
else:
    # app/config.py -> app/ -> root
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    STATIC_FOLDER = os.path.join(BASE_DIR, 'frontend', 'build')

DB_FILE = os.path.join(BASE_DIR, 'sys_data.dat')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LOG_FILE = os.path.join(BASE_DIR, 'debug_log.txt')

# Ensure backup directory exists
os.makedirs(BACKUP_DIR, exist_ok=True)
