"""EasyBioVibe-IMS desktop launcher.

Starts the bundled Flask server in the background, opens the default
browser to it, and shows a system-tray icon (Open / Quit) so the app
behaves like any other installed desktop application rather than a
terminal window you have to babysit.

If no system tray is available (some minimal Linux setups), it falls
back to a plain console you can stop with Ctrl+C.
"""
import sys
import os
import time
import threading
import webbrowser
import urllib.request

HOST = "127.0.0.1"
PORT = 5000
URL = f"http://{HOST}:{PORT}/"


def resource_path(relative):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


def server_is_up():
    try:
        urllib.request.urlopen(f"http://{HOST}:{PORT}/api/status", timeout=1)
        return True
    except Exception:
        return False


def start_server():
    import app as flask_app_module  # app.py, bundled alongside this launcher
    flask_app_module.app.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)


def wait_for_server(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if server_is_up():
            return True
        time.sleep(0.3)
    return False


def run_tray():
    try:
        import pystray
        from PIL import Image

        image = Image.open(resource_path(os.path.join("assets", "icon_256.png")))

        def on_open(icon, item):
            webbrowser.open(URL)

        def on_quit(icon, item):
            icon.stop()
            os._exit(0)

        menu = pystray.Menu(
            pystray.MenuItem("Open EasyBioVibe-IMS", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        )
        pystray.Icon("EasyBioVibe-IMS", image, "EasyBioVibe-IMS", menu).run()
    except Exception as e:
        print(f"[EasyBioVibe-IMS] System tray unavailable ({e}); running in console mode.")
        print(f"[EasyBioVibe-IMS] Server running at {URL} -- press Ctrl+C here to quit.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            os._exit(0)


def main():
    if server_is_up():
        # Already running (icon double-clicked again) -- just open a tab, don't start a 2nd server
        webbrowser.open(URL)
        return

    threading.Thread(target=start_server, daemon=True).start()

    if wait_for_server():
        webbrowser.open(URL)
    else:
        print(f"[EasyBioVibe-IMS] Server did not respond within the timeout. Try opening {URL} manually.")

    run_tray()


if __name__ == "__main__":
    main()