from flask import Blueprint, jsonify, send_from_directory
import os
from ..utils import update_heartbeat
from ..config import STATIC_FOLDER

bp = Blueprint('core', __name__)

@bp.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    timestamp = update_heartbeat()
    return jsonify({"status": "alive", "timestamp": timestamp})

# 13. SERVE REACT APP
@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(STATIC_FOLDER, path)):
        return send_from_directory(STATIC_FOLDER, path)
    else:
        return send_from_directory(STATIC_FOLDER, 'index.html')
