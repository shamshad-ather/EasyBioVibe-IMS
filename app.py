import socket
import webbrowser
from flask import Flask, render_template, request, jsonify, session
from flask_bcrypt import Bcrypt
from functools import wraps
import sqlite3
import datetime
import os
import sys
import secrets
from pathlib import Path
import time
import threading
import signal


def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))
        
    return os.path.join(base_path, relative_path)

def get_app_version():
    try:
        # 1. Check inside PyInstaller's temporary _MEIPASS extraction folder
        meipass_path = os.path.join(getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__))), 'VERSION.md')
        if os.path.exists(meipass_path):
            with open(meipass_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        
        # 2. Fallback check in the current working directory (for local testing)
        if os.path.exists('VERSION.md'):
            with open('VERSION.md', 'r', encoding='utf-8') as f:
                return f.read().strip()
                
        # If neither path has the file, return a precise missing error
        return "vUnknown (File Missing)"
        
    except Exception as e:
        # If the file exists but Windows blocks it (encoding/permissions)
        return f"vUnknown (Err: {str(e)})"

APP_VERSION = get_app_version()

def gen_code(name, fallback='GEN'):
    import re
    parts = [p for p in re.split(r'[\s\-_]+', (name or '').strip()) if p]
    if len(parts) >= 2:
        code = ''.join(p[0] for p in parts[:5]).upper()
    elif len(parts) == 1:
        code = parts[0][:4].upper()
    else:
        code = ''
    return code or fallback

# Fixed, admin-controlled designation list (see /api/users).
DESIGNATIONS = [
    'HoD', 'Faculty', 'Lab Tech', 'Student', 'JR', 'SR',
    'Research Associate', 'Project Associate', 'Research Assistant',
    'Project Assistant', 'Intern', 'IT personal', 'Other'
]
DEFAULT_PASSWORD = 'password123'

app = Flask(__name__, template_folder=resource_path('templates'), static_folder=resource_path('static'))

_CACHE_DIR = os.path.join(Path.home(), '.cache', 'easybiovibe')
os.makedirs(_CACHE_DIR, exist_ok=True)

# --- Secret key: generated once per install, never hardcoded/committed ---
# A hardcoded secret_key baked into every copy of the source (and every
# packaged executable built from it) lets anyone who has read the public
# repo forge a signed session cookie for ANY install of this app -- e.g.
# a cookie claiming {"user": "attacker", "role": "Admin"} -- with no
# password required at all. Instead, generate a random key the first time
# the app runs on a given machine and reuse it from then on.
_SECRET_KEY_PATH = os.path.join(_CACHE_DIR, 'secret.key')
if not os.path.exists(_SECRET_KEY_PATH):
    with open(_SECRET_KEY_PATH, 'w') as f:
        f.write(secrets.token_hex(32))
with open(_SECRET_KEY_PATH, 'r') as f:
    app.secret_key = f.read().strip()

bcrypt = Bcrypt(app)

DB_PATH = os.path.join(_CACHE_DIR, 'easybiovibe.db')

_OLD_DB_PATH = os.path.join(Path.home(), 'easylab_database.db')
if not os.path.exists(DB_PATH) and os.path.exists(_OLD_DB_PATH):
    import shutil
    shutil.copy2(_OLD_DB_PATH, DB_PATH)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS App_Settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT UNIQUE, 
        password TEXT, 
        role TEXT, 
        department TEXT,
        study_ids TEXT,
        status TEXT DEFAULT 'Active'
    )''')

    for col, col_type in [("faculty_id", "INTEGER"), ("designation", "TEXT"), ("must_change_password", "INTEGER DEFAULT 0")]:
        try:
            c.execute(f"ALTER TABLE Users ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass
    
    # Inventory is now a master material catalog (Department removed)
    c.execute('''CREATE TABLE IF NOT EXISTS Inventory_Master (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        item_code TEXT UNIQUE, 
        material_name TEXT, 
        make TEXT, 
        model TEXT,
        category TEXT, 
        pack_size REAL, 
        base_unit TEXT,
        vendor_id INTEGER
    )''')
    
    for col, col_type in [("model", "TEXT"), ("vendor_id", "INTEGER")]:
        try:
            c.execute(f"ALTER TABLE Inventory_Master ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass

    # Physical Batches now track procurement location (Department & Study)
    c.execute('''CREATE TABLE IF NOT EXISTS Physical_Batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        batch_code TEXT, 
        inventory_id INTEGER, 
        po_number TEXT, 
        lot_number TEXT, 
        expiry_date TEXT, 
        date_first_used TEXT, 
        quantity_received REAL, 
        current_quantity REAL, 
        unit TEXT, 
        department_id INTEGER,
        study_id INTEGER,
        status TEXT DEFAULT 'Active', 
        remarks TEXT,
        FOREIGN KEY(inventory_id) REFERENCES Inventory_Master(id),
        FOREIGN KEY(department_id) REFERENCES Departments(id),
        FOREIGN KEY(study_id) REFERENCES Studies(id)
    )''')

    for col, col_type in [("department_id", "INTEGER"), ("study_id", "INTEGER")]:
        try:
            c.execute(f"ALTER TABLE Physical_Batches ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Usage_Logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT, 
        inventory_id INTEGER, 
        batch_code TEXT, 
        quantity_used REAL, 
        unit_used TEXT, 
        timestamp TEXT, 
        activity_type TEXT, 
        department TEXT, 
        faculty TEXT, 
        study TEXT
    )''')

    for col, col_type in [("user_id", "TEXT"), ("batch_id", "INTEGER"), ("department_id", "TEXT"), ("faculty_id", "TEXT"), ("study_id", "TEXT"), ("remarks", "TEXT"), ("balance_after", "REAL"), ("recorded_by", "TEXT")]:
        try:
            c.execute(f"ALTER TABLE Usage_Logs ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, status TEXT DEFAULT 'Active', remarks TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS Faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, department_id INTEGER, status TEXT DEFAULT 'Active'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS Studies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, type TEXT, faculty_id INTEGER, department_id INTEGER, description TEXT, status TEXT DEFAULT 'Active'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS Vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_code TEXT, vendor_name TEXT, contact_number TEXT, remarks TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS Documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT, document_code TEXT, title TEXT, document_type TEXT, version TEXT, linked_inventory_id INTEGER, remarks TEXT
    )''')
    for col, col_type in [("link_url", "TEXT")]:
        try:
            c.execute(f"ALTER TABLE Documents ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass

    c.execute('''CREATE TABLE IF NOT EXISTS History_Logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history_code TEXT,
        entity TEXT,
        entity_code TEXT,
        field_changed TEXT,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT,
        changed_date TEXT
    )''')

    conn.commit()
    conn.close()

init_db()

# ==================== AUTH ====================
# Nearly every data route below previously had no session check at all,
# and /api/users' edit path let anyone reset any user's password with no
# login. These two decorators are the single source of truth for auth from
# here on -- every route that reads or writes lab data requires a real
# login, and anything sensitive (user management, DB export/import,
# settings) requires the Admin role specifically.
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user'):
            return jsonify({"status": "error", "message": "Not logged in"}), 401
        return fn(*args, **kwargs)
    return wrapper

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user'):
            return jsonify({"status": "error", "message": "Not logged in"}), 401
        if session.get('role') != 'Admin':
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def system_status():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM Users")
    count = c.fetchone()[0]
    conn.close()
    return jsonify({
        "setup_required": count == 0,
        "logged_in": bool(session.get('user')),
        "username": session.get('user'),
        "role": session.get('role')
    })

@app.route('/api/setup', methods=['POST'])
def setup_system():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM Users")
    if c.fetchone()[0] > 0:
        conn.close()
        return jsonify({"status": "error", "message": "System is already configured."})
        
    try:
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_name', ?)", (data.get('lab_name', 'Central Research Laboratory'),))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_abbrev', ?)", (data.get('lab_abbrev', 'LAB'),))
        
        faculty_id = None
        dept_name_for_user = data.get('department_name', 'Administration').strip()
        
        if data.get('is_faculty') and dept_name_for_user:
            dept_code = gen_code(dept_name_for_user, 'DEP')
            c.execute("INSERT INTO Departments (name, code, status, remarks) VALUES (?, ?, 'Active', ?)",
                      (dept_name_for_user, dept_code, 'Auto-created during setup'))
            dept_id = c.lastrowid
            
            c.execute("SELECT MAX(id) FROM Faculty")
            max_id = c.fetchone()[0] or 0
            fac_code = f"FAC{str(max_id + 1).zfill(4)}"
            
            c.execute("INSERT INTO Faculty (name, code, department_id, status) VALUES (?, ?, ?, 'Active')",
                      (data.get('username'), fac_code, dept_id))
            faculty_id = c.lastrowid

        hashed_pw = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')
        c.execute("INSERT INTO Users (username, password, role, department, designation, study_ids, status, faculty_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
                  (data.get('username'), hashed_pw, 'Admin', dept_name_for_user, data.get('designation', 'HoD'), 'ALL', 'Active', faculty_id))
        
        conn.commit()
        
        # Log the user in to avoid 401 errors right after setup
        session['user'] = data.get('username')
        session['role'] = 'Admin'
        
        status = "success"
        message = "Setup complete."
    except Exception as e:
        status = "error"
        message = str(e)
        
    conn.close()
    return jsonify({"status": status, "message": message})

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        if not session.get('user'):
            return jsonify({"status": "error", "message": "Not logged in"}), 401
        if session.get('role') != 'Admin':
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_name', ?)", (data.get('lab_name'),))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_abbrev', ?)", (data.get('lab_abbrev'),))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
        
    c.execute("SELECT * FROM App_Settings")
    rows = c.fetchall()
    settings = {row['setting_key']: row['setting_value'] for row in rows}
    conn.close()
    settings['app_version'] = APP_VERSION
    return jsonify(settings)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM Users WHERE username=?", (data.get('username'),))
    user = c.fetchone()
    conn.close()
    if user and bcrypt.check_password_hash(user['password'], data.get('password')):
        session['user'] = data.get('username')
        session['role'] = user['role']
        return jsonify({
            "status": "success", "role": user['role'], "username": data.get('username'),
            "must_change_password": bool(user['must_change_password'])
        })
    return jsonify({"status": "error", "message": "Invalid username or password"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route('/api/inventory', methods=['GET', 'POST'])
@login_required
def handle_inventory():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        vendor_id = int(data['vendor_id']) if data.get('vendor_id') else None
        try:
            if item_id:
                c.execute("""UPDATE Inventory_Master 
                             SET material_name=?, make=?, model=?, category=?, pack_size=?, base_unit=?, vendor_id=?
                             WHERE id=?""",
                          (data['material_name'], data.get('make', ''), data.get('model', ''), data.get('category', 'Other'), data.get('pack_size', 15), data.get('base_unit', 'Nos'), vendor_id, item_id))
            else:
                c.execute("""INSERT INTO Inventory_Master (item_code, material_name, make, model, category, pack_size, base_unit, vendor_id) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                          (data.get('item_code'), data['material_name'], data.get('make', ''), data.get('model', ''), data.get('category', 'Other'), data.get('pack_size', 15), data.get('base_unit', 'Nos'), vendor_id))
            conn.commit()
            status = "success"
        except sqlite3.IntegrityError:
            status = "error"
        conn.close()
        return jsonify({"status": status})
    
    c.execute("SELECT * FROM Inventory_Master")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/departments', methods=['GET', 'POST'])
@login_required
def handle_departments():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        if item_id:
            c.execute("UPDATE Departments SET name=?, status=?, remarks=? WHERE id=?",
                      (data.get('name'), data.get('status', 'Active'), data.get('remarks', ''), item_id))
        else:
            dept_code = data.get('code') or gen_code(data.get('name'), 'DEP')
            c.execute("INSERT INTO Departments (name, code, status, remarks) VALUES (?, ?, ?, ?)",
                      (data.get('name'), dept_code, data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Departments")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/faculty', methods=['GET', 'POST'])
@login_required
def handle_faculty():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        note = None
        if item_id:
            c.execute("UPDATE Faculty SET name=?, department_id=?, status=? WHERE id=?",
                      (data.get('name'), data.get('department_id'), data.get('status', 'Active'), item_id))
        else:
            c.execute("SELECT MAX(id) FROM Faculty")
            max_id = c.fetchone()[0] or 0
            fac_code = f"FAC{str(max_id + 1).zfill(4)}"
            
            c.execute("INSERT INTO Faculty (name, code, department_id, status) VALUES (?, ?, ?, ?)",
                      (data.get('name'), fac_code, data.get('department_id'), data.get('status', 'Active')))
            new_faculty_id = c.lastrowid

            dept_name = ''
            if data.get('department_id'):
                c.execute("SELECT name FROM Departments WHERE id=?", (data.get('department_id'),))
                d = c.fetchone()
                dept_name = d['name'] if d else ''

            # Only an Admin may provision a new login account -- adding a
            # Faculty master record used to auto-create one for anyone who
            # was merely logged in (or, before login_required existed above,
            # for anyone at all), bypassing the "Admin-only user creation"
            # rule entirely. A non-admin still gets the Faculty record; they
            # just don't get a free login account handed out alongside it.
            if session.get('role') == 'Admin':
                try:
                    hashed_pw = bcrypt.generate_password_hash(DEFAULT_PASSWORD).decode('utf-8')
                    c.execute("""INSERT INTO Users (username, password, role, department, designation, study_ids, status, faculty_id, must_change_password)
                                 VALUES (?, ?, 'Manager', ?, 'Faculty', 'ALL', 'Active', ?, 1)""",
                              (data.get('name'), hashed_pw, dept_name, new_faculty_id))
                    note = f"Login created for this faculty member (default password: {DEFAULT_PASSWORD})."
                except sqlite3.IntegrityError:
                    note = "Faculty saved, but a user with that username already exists — link the account manually."
            else:
                note = "Faculty saved. Ask an Admin to create a login account for them from the Users page."
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": note})
    
    c.execute("SELECT * FROM Faculty")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/studies', methods=['GET', 'POST'])
@login_required
def handle_studies():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        if item_id:
            c.execute("""UPDATE Studies SET name=?, type=?, faculty_id=?, department_id=?, description=?, status=? WHERE id=?""",
                      (data.get('name'), data.get('type'), data.get('faculty_id'), data.get('department_id'), data.get('description', ''), data.get('status', 'Active'), item_id))
        else:
            study_code = data.get('code') or gen_code(data.get('name'), 'STD')
            c.execute("""INSERT INTO Studies (name, code, type, faculty_id, department_id, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                      (data.get('name'), study_code, data.get('type'), data.get('faculty_id'), data.get('department_id'), data.get('description', ''), data.get('status', 'Active')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Studies")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/users', methods=['GET', 'POST'])
@login_required
def handle_users():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        # Creating a user, or changing ANY field on an existing one (role,
        # status, and -- this was the critical hole -- password) is
        # admin-only. The old code only checked the role on the "create"
        # path; the "edit" path (item_id present) ran unconditionally, so
        # anyone, logged in or not, could POST {"id": 1, "password": "x"}
        # and take over any account, including the head Admin's.
        if session.get('role') != 'Admin':
            conn.close()
            return jsonify({"status": "error", "message": "Admin privileges required to add or modify users"}), 403

        data = request.get_json()
        item_id = data.get('id')

        target_role = data.get('role', 'Manager')
        designation = data.get('designation', 'Other')
        if designation not in DESIGNATIONS:
            designation = 'Other'

        study_ids = data.get('study_ids', ['ALL'])
        study_ids_str = ",".join(map(str, study_ids)) if isinstance(study_ids, list) else str(study_ids)
        password_provided = data.get('password')

        if item_id:
            # Guard against locking everyone out by demoting/deactivating
            # the last remaining active Admin.
            if target_role != 'Admin' or data.get('status', 'Active') != 'Active':
                c.execute("SELECT role, status FROM Users WHERE id=?", (item_id,))
                target = c.fetchone()
                if target and target['role'] == 'Admin' and target['status'] == 'Active':
                    c.execute("SELECT COUNT(*) FROM Users WHERE role='Admin' AND status='Active'")
                    if c.fetchone()[0] <= 1:
                        conn.close()
                        return jsonify({"status": "error", "message": "Can't remove the last active Admin"}), 400

            if password_provided:
                hashed_pw = bcrypt.generate_password_hash(password_provided).decode('utf-8')
                c.execute("UPDATE Users SET username=?, password=?, role=?, department=?, designation=?, study_ids=?, status=?, must_change_password=0 WHERE id=?",
                          (data.get('name'), hashed_pw, target_role, data.get('department', ''), designation, study_ids_str, data.get('status', 'Active'), item_id))
            else:
                c.execute("UPDATE Users SET username=?, role=?, department=?, designation=?, study_ids=?, status=? WHERE id=?",
                          (data.get('name'), target_role, data.get('department', ''), designation, study_ids_str, data.get('status', 'Active'), item_id))
        else:
            pw_to_hash = password_provided if password_provided else DEFAULT_PASSWORD
            hashed_pw = bcrypt.generate_password_hash(pw_to_hash).decode('utf-8')
            c.execute("INSERT INTO Users (username, password, role, department, designation, study_ids, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
                      (data.get('name'), hashed_pw, target_role, data.get('department', ''), designation, study_ids_str, data.get('status', 'Active')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "default_password": DEFAULT_PASSWORD if not item_id and not password_provided else None})

    # GET stays login-only (not admin-only): every signed-in user needs the
    # roster to populate the "who used it" picker on the usage-log form.
    c.execute("SELECT id, username AS user_name, role, department, designation, study_ids, status FROM Users")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

# ==================== MY PROFILE (self-service) ====================
# /api/users is now admin-only (see fix for the password-reset hole above),
# which would otherwise break the existing "My Profile" self-edit feature
# for every non-admin user. These two routes let anyone edit their OWN
# department/designation/username and change their OWN password (with
# their current password required) without needing Admin rights, and
# without touching role/status -- those stay admin-only via /api/users.
@app.route('/api/profile', methods=['GET', 'POST'])
@login_required
def handle_profile():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM Users WHERE username=?", (session['user'],))
    me = c.fetchone()
    if not me:
        conn.close()
        return jsonify({"status": "error", "message": "User not found"}), 404

    if request.method == 'POST':
        data = request.get_json()
        new_username = (data.get('name') or me['username']).strip()
        designation = data.get('designation', me['designation'] or '')
        if designation not in DESIGNATIONS:
            designation = 'Other'
        department = data.get('department', me['department'] or '')

        try:
            c.execute("UPDATE Users SET username=?, department=?, designation=? WHERE id=?",
                      (new_username, department, designation, me['id']))
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"status": "error", "message": "That username is already taken"}), 400

        if new_username != session['user']:
            session['user'] = new_username  # keep the session in sync with a self-rename

        conn.close()
        return jsonify({"status": "success", "username": new_username})

    profile = {"id": me['id'], "name": me['username'], "role": me['role'], "status": me['status'],
               "department": me['department'] or '', "designation": me['designation'] or ''}
    conn.close()
    return jsonify(profile)

@app.route('/api/profile/password', methods=['POST'])
@login_required
def change_own_password():
    data = request.get_json()
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    if not new_password or len(new_password) < 6:
        return jsonify({"status": "error", "message": "New password must be at least 6 characters"}), 400

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM Users WHERE username=?", (session['user'],))
    me = c.fetchone()
    if not me or not bcrypt.check_password_hash(me['password'], current_password):
        conn.close()
        return jsonify({"status": "error", "message": "Current password is incorrect"}), 401

    hashed_pw = bcrypt.generate_password_hash(new_password).decode('utf-8')
    c.execute("UPDATE Users SET password=?, must_change_password=0 WHERE id=?", (hashed_pw, me['id']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/batches', methods=['GET', 'POST'])
@login_required
def handle_batches():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        dept_id = int(data['department_id']) if data.get('department_id') else None
        study_id = int(data['study_id']) if data.get('study_id') else None

        if item_id:
            c.execute("""UPDATE Physical_Batches 
                         SET inventory_id=?, po_number=?, lot_number=?, expiry_date=?, date_first_used=?, quantity_received=?, current_quantity=?, unit=?, department_id=?, study_id=?, status=?, remarks=? 
                         WHERE id=?""",
                      (data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), dept_id, study_id, data.get('status', 'Active'), data.get('remarks', ''), item_id))
        else:
            c.execute("SELECT MAX(id) FROM Physical_Batches")
            max_id = c.fetchone()[0] or 0
            batch_code = f"BAT{str(max_id + 1).zfill(6)}"
            
            c.execute("""INSERT INTO Physical_Batches (batch_code, inventory_id, po_number, lot_number, expiry_date, date_first_used, quantity_received, current_quantity, unit, department_id, study_id, status, remarks) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (batch_code, data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), dept_id, study_id, data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Physical_Batches ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/vendors', methods=['GET', 'POST'])
@login_required
def handle_vendors():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        if item_id:
            c.execute("UPDATE Vendors SET vendor_name=?, contact_number=?, remarks=? WHERE id=?",
                      (data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', ''), item_id))
        else:
            c.execute("INSERT INTO Vendors (vendor_code, vendor_name, contact_number, remarks) VALUES (?, ?, ?, ?)",
                      (data.get('vendor_code'), data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', '')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Vendors ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/documents', methods=['GET', 'POST'])
@login_required
def handle_documents():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        linked_id = data.get('linked_inventory_id')
        linked_id = int(linked_id) if linked_id else None

        if item_id:
            c.execute("""UPDATE Documents SET title=?, document_type=?, version=?, linked_inventory_id=?, remarks=?, link_url=? WHERE id=?""",
                      (data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), linked_id, data.get('remarks', ''), data.get('link_url', ''), item_id))
        else:
            c.execute("""INSERT INTO Documents (document_code, title, document_type, version, linked_inventory_id, remarks, link_url) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)""",
                      (data.get('document_code'), data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), linked_id, data.get('remarks', ''), data.get('link_url', '')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Documents ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/wizard_data', methods=['GET'])
@login_required
def wizard_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name AS dept_name, code AS dept_code, status, remarks FROM Departments")
    depts = [dict(r) for r in c.fetchall()]
    
    c.execute("SELECT id, name AS fac_name, code AS fac_code, department_id, status FROM Faculty")
    facs = [dict(r) for r in c.fetchall()]
    
    c.execute("SELECT id, name AS study_name, code AS study_code, type AS study_type, faculty_id, department_id, description, status FROM Studies")
    studies = [dict(r) for r in c.fetchall()]
    
    c.execute("SELECT id, username AS user_name, role, department, designation, study_ids, status FROM Users")
    users = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return jsonify({"departments": depts, "faculty": facs, "studies": studies, "users": users})

@app.route('/api/usage', methods=['GET', 'POST'])
@login_required
def handle_usage():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        batch_id = data.get('batch_id')
        qty_used = float(data.get('quantity_used', 0))
        
        c.execute("SELECT current_quantity FROM Physical_Batches WHERE id = ?", (batch_id,))
        batch = c.fetchone()
        if not batch:
            conn.close()
            return jsonify({"status": "error", "message": "Batch not found"}), 400
            
        current_qty = float(batch['current_quantity'])
        if current_qty < qty_used:
            conn.close()
            return jsonify({"status": "error", "message": "Insufficient stock in selected batch"}), 400
            
        new_qty = max(0.0, current_qty - qty_used)
        new_status = 'Active' if new_qty > 0 else 'Depleted'
        new_qty = round(new_qty, 4)
        
        c.execute("UPDATE Physical_Batches SET current_quantity = ?, status = ? WHERE id = ?", 
                  (new_qty, new_status, batch_id))
        
        actual_recorder = session['user']
        consumer_user_id = data.get('user_id', '')

        c.execute("""INSERT INTO Usage_Logs 
                     (username, inventory_id, batch_code, quantity_used, unit_used, timestamp, activity_type, department, faculty, study,
                      user_id, batch_id, department_id, faculty_id, study_id, remarks, balance_after, recorded_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                  (consumer_user_id, 
                   data.get('inventory_id'), 
                   data.get('batch_code', ''), 
                   qty_used, 
                   data.get('unit', ''), 
                   datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 
                   'Lab Usage', 
                   data.get('department_id', ''), 
                   data.get('faculty_id', ''), 
                   data.get('study_id', ''),
                   consumer_user_id,
                   batch_id,
                   data.get('department_id', ''),
                   data.get('faculty_id', ''),
                   data.get('study_id', ''),
                   data.get('remarks', ''),
                   new_qty,
                   actual_recorder))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Usage_Logs ORDER BY id DESC LIMIT 100")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/history', methods=['GET', 'POST'])
@login_required
def handle_history():
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.get_json()
        
        c.execute("SELECT MAX(id) FROM History_Logs")
        max_id = c.fetchone()[0] or 0
        history_code = f"HIS{str(max_id + 1).zfill(6)}"
        
        actual_changer = session['user']
        
        c.execute("""INSERT INTO History_Logs 
                     (history_code, entity, entity_code, field_changed, old_value, new_value, changed_by, changed_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                  (history_code, 
                   data.get('entity', ''), 
                   data.get('entity_code', ''), 
                   data.get('field_changed', ''), 
                   data.get('old_value', ''), 
                   data.get('new_value', ''), 
                   actual_changer, 
                   datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
        
    c.execute("SELECT * FROM History_Logs ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

from flask import send_file

@app.route('/api/export_db', methods=['GET'])
@admin_required
def export_db():
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    return send_file(DB_PATH, as_attachment=True, download_name=f'easybiovibe-backup-{stamp}.db')

@app.route('/api/import_db', methods=['POST'])
@admin_required
def import_db():
    f = request.files.get('dbfile')
    if not f:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
    header = f.read(16)
    f.seek(0)
    if header[:15] != b'SQLite format 3':
        return jsonify({"status": "error", "message": "That doesn't look like a valid EasyBio.Vibe database file"}), 400
    if os.path.exists(DB_PATH):
        backup_path = DB_PATH + '.before-import'
        import shutil
        shutil.copy2(DB_PATH, backup_path)
    f.save(DB_PATH)
    return jsonify({"status": "success", "message": "Database imported. Restart EasyBio.Vibe for it to take effect."})

# ==================== PING SHUTDOWN ====================
LAST_PING = time.time()

@app.route('/api/ping', methods=['POST'])
def ping():
    global LAST_PING
    LAST_PING = time.time()
    return jsonify({"status": "ok"})

def monitor_heartbeat():
    # Give the server 10 seconds to boot up and load the initial UI
    time.sleep(10)
    while True:
        time.sleep(5)
        # If 15 seconds pass without a ping from the browser, shut down
        if time.time() - LAST_PING > 15:
            print("Window closed. Shutting down server to free port...")
            os.kill(os.getpid(), signal.SIGTERM)

def get_free_port():
    """Asks the OS to assign an available port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]

if __name__ == '__main__':
    frozen = getattr(sys, 'frozen', False)
    
    # 1. Ask the OS for a free port, OR grab it from the environment if this is the Worker process
    if 'EASYBIO_PORT' in os.environ:
        port = int(os.environ['EASYBIO_PORT'])
    else:
        port = get_free_port()
        os.environ['EASYBIO_PORT'] = str(port)
    
    if frozen or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        # Start the background heartbeat monitor
        monitor_thread = threading.Thread(target=monitor_heartbeat, daemon=True)
        monitor_thread.start()
        
        # 2. Auto-launch the browser to the dynamic port (after a 1.5s delay to let Flask boot)
        target_url = f'http://127.0.0.1:{port}'
        threading.Timer(1.5, lambda: webbrowser.open(target_url)).start()
        print(f"\n=======================================================")
        print(f"EasyBio.Vibe IMS ({APP_VERSION}) is booting up...")
        print(f"Opening automatically in your browser at: {target_url}")
        print(f"=======================================================\n")
    
    # 3. Bind Flask to the synchronized dynamic port
    app.run(debug=not frozen, use_reloader=not frozen, host='127.0.0.1', port=port)