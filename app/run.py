import os
import sys
import time
import socket
import signal
import threading
import webbrowser
import argparse
from flask import jsonify

from app import create_app
from app.database import trigger_backup

app = None
LAST_PING = time.time()

def _get_app():
    global app
    if app is None:
        app = create_app()

        @app.route('/api/ping', methods=['GET', 'POST'])
        def ping():
            global LAST_PING
            LAST_PING = time.time()
            return jsonify({"status": "ok"})
    return app

def __getattr__(name):
    if name == 'app':
        return _get_app()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

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

def parse_args(args=None):
    parser = argparse.ArgumentParser(
        prog="easybiovibe",
        description="EasyBioVibe-IMS: Molecular biology and RT-qPCR laboratory inventory management system"
    )
    parser.add_argument(
        '--install-shortcut',
        action='store_true',
        help="Generate and install the native OS desktop launcher / Start Menu shortcut and exit"
    )
    parser.add_argument(
        '--port',
        type=int,
        default=None,
        help="Custom port to bind the Flask web application"
    )
    return parser.parse_args(args)

def start_server(port=None):
    frozen = getattr(sys, 'frozen', False)
    if port is None:
        port = int(os.environ.get('EASYBIO_PORT', get_free_port()))
    os.environ['EASYBIO_PORT'] = str(port)
    
    if frozen or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Thread(target=monitor_heartbeat, daemon=True).start()
        threading.Timer(1.5, lambda: webbrowser.open(f'http://127.0.0.1:{port}')).start()
        print(f"\nEasyBio.Vibe LIMS booting up at http://127.0.0.1:{port}\n")
        
    flask_app = _get_app()
    flask_app.run(debug=not frozen, use_reloader=not frozen, host='127.0.0.1', port=port)

def main(args=None):
    parsed = parse_args(args)
    if parsed.install_shortcut:
        from app.shortcut import create_shortcut
        created_path = create_shortcut()
        print(f"[SUCCESS] Native launcher installed successfully at: {created_path}")
        sys.exit(0)

    start_server(port=parsed.port)

if __name__ == '__main__':
    main()
