import os
import secrets
from pathlib import Path
from flask import Flask, render_template
from flask_bcrypt import Bcrypt
from app.utils import resource_path
from app.database import init_db

bcrypt = Bcrypt()
_CACHE_DIR = os.path.join(Path.home(), '.cache', 'easybiovibe')

def create_app():
    os.makedirs(_CACHE_DIR, exist_ok=True)
    app = Flask(__name__, template_folder=resource_path('templates'), static_folder=resource_path('static'))
    
    # Safely generate and store the Flask session secret key
    secret_key_path = os.path.join(_CACHE_DIR, 'secret.key')
    if not os.path.exists(secret_key_path):
        with open(secret_key_path, 'w') as f:
            f.write(secrets.token_hex(32))
    with open(secret_key_path, 'r') as f:
        app.secret_key = f.read().strip()
    
    bcrypt.init_app(app)
    init_db()

    # The Base Route to load your modular Frontend
    @app.route('/')
    def home():
        return render_template('index.html')

    # Import Blueprints (Matching your actual folder structure)
    from app.routes.auth import auth_bp
    from app.routes.system import system_bp
    from app.routes.masters import masters_bp          # Handles Depts, Faculty, Users, Docs
    from app.routes.inventory import inventory_bp      # Handles Inventory Master
    from app.routes.transactions import transactions_bp # Handles Batches, Usage, History
    from app.routes.equipment import equipment_bp      # Handles Equipment & Events

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(masters_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(equipment_bp)

    return app