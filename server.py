from app import create_app
import threading
import socket
import logging
import webbrowser
from app.utils import monitor

app = create_app()

if __name__ == '__main__':
    # Start monitoring thread
    threading.Thread(target=monitor, daemon=True).start()
    
    # Find available port
    port = 5000
    for p in range(5000, 5100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', p)) != 0:
                port = p
                break
    
    print(f"Starting server on port {port}")
    logging.info(f"Starting server on port {port}")
    
    # Open browser
    webbrowser.open(f"http://127.0.0.1:{port}")

    # Run Flask app
    app.run(host='127.0.0.1', port=port, debug=False)
