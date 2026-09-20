import os
import sys
import time
import socket
import signal
import threading
import webbrowser
from flask import jsonify

from app import create_app
from app.database import trigger_backup

app = create_app()
LAST_PING = time.time()

@app.route('/api/ping', methods=['GET', 'POST'])
def ping():
    global LAST_PING
    LAST_PING = time.time()
    return jsonify({"status": "ok"})

def monitor_heartbeat():
    time.sleep(30)
    while True:
        time.sleep(15)
        if time.time() - LAST_PING > 900:  # 15 minutes tolerance for background tab throttling
            print("Session idle or window closed (15 min). Shutting down server...")
            trigger_backup()
            os.kill(os.getpid(), signal.SIGTERM)

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]

if __name__ == '__main__':
    frozen = getattr(sys, 'frozen', False)
    port = int(os.environ.get('EASYBIO_PORT', get_free_port()))
    os.environ['EASYBIO_PORT'] = str(port)
    
    if frozen or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Thread(target=monitor_heartbeat, daemon=True).start()
        threading.Timer(1.5, lambda: webbrowser.open(f'http://127.0.0.1:{port}')).start()
        print(f"\nEasyBio.Vibe LIMS booting up at http://127.0.0.1:{port}\n")
        
    app.run(debug=not frozen, use_reloader=not frozen, host='127.0.0.1', port=port)