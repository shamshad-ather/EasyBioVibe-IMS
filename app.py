from flask import Flask, render_template, request, jsonify, session
from flask_bcrypt import Bcrypt
import sqlite3
import datetime
import os
import sys
from pathlib import Path

def resource_path(relative):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

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

app = Flask(__name__, template_folder=resource_path('templates'), static_folder=resource_path('static'))
app.secret_key = "easybiovibe_super_secret_key"
bcrypt = Bcrypt(app)

_CACHE_DIR = os.path.join(Path.home(), '.cache', 'easybiovibe')
os.makedirs(_CACHE_DIR, exist_ok=True)
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

    for col, col_type in [("faculty_id", "INTEGER"), ("designation", "TEXT")]:
        try:
            c.execute(f"ALTER TABLE Users ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Inventory_Master (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        item_code TEXT UNIQUE, 
        material_name TEXT, 
        make TEXT, 
        model TEXT,
        category TEXT, 
        pack_size REAL, 
        base_unit TEXT,
        vendor_id INTEGER,
        department_id INTEGER
    )''')
    
    for col, col_type in [("model", "TEXT"), ("vendor_id", "INTEGER"), ("department_id", "INTEGER")]:
        try:
            c.execute(f"ALTER TABLE Inventory_Master ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass

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
        status TEXT DEFAULT 'Active', 
        remarks TEXT,
        FOREIGN KEY(inventory_id) REFERENCES Inventory_Master(id)
    )''')
    
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
        return jsonify({"status": "success", "role": user['role'], "username": data.get('username')})
    return jsonify({"status": "error", "message": "Invalid username or password"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route('/api/inventory', methods=['GET', 'POST'])
def handle_inventory():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        vendor_id = int(data['vendor_id']) if data.get('vendor_id') else None
        department_id = int(data['department_id']) if data.get('department_id') else None
        try:
            if item_id:
                c.execute("""UPDATE Inventory_Master 
                             SET material_name=?, make=?, model=?, category=?, pack_size=?, base_unit=?, vendor_id=?, department_id=? 
                             WHERE id=?""",
                          (data['material_name'], data.get('make', ''), data.get('model', ''), data.get('category', 'Other'), data.get('pack_size', 15), data.get('base_unit', 'Nos'), vendor_id, department_id, item_id))
            else:
                c.execute("""INSERT INTO Inventory_Master (item_code, material_name, make, model, category, pack_size, base_unit, vendor_id, department_id) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                          (data.get('item_code'), data['material_name'], data.get('make', ''), data.get('model', ''), data.get('category', 'Other'), data.get('pack_size', 15), data.get('base_unit', 'Nos'), vendor_id, department_id))
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
            try:
                hashed_pw = bcrypt.generate_password_hash('password123').decode('utf-8')
                c.execute("""INSERT INTO Users (username, password, role, department, designation, study_ids, status, faculty_id)
                             VALUES (?, ?, 'Manager', ?, 'Faculty', 'ALL', 'Active', ?)""",
                          (data.get('name'), hashed_pw, dept_name, new_faculty_id))
                note = "Login created for this faculty member (default password: password123)."
            except sqlite3.IntegrityError:
                note = "Faculty saved, but a user with that username already exists — link the account manually."
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": note})
    
    c.execute("SELECT * FROM Faculty")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/studies', methods=['GET', 'POST'])
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
def handle_users():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        current_user_role = session.get('role', 'Manager')
        
        if not item_id and current_user_role != 'Admin':
            return jsonify({"status": "error", "message": "Only Admins can add new users."}), 403
            
        target_role = data.get('role', 'Manager')
        if target_role == 'Admin' and current_user_role != 'Admin':
            target_role = 'Manager'
        
        study_ids = data.get('study_ids', ['ALL'])
        study_ids_str = ",".join(map(str, study_ids)) if isinstance(study_ids, list) else str(study_ids)
        password_provided = data.get('password')
        
        if item_id:
            if password_provided:
                hashed_pw = bcrypt.generate_password_hash(password_provided).decode('utf-8')
                c.execute("UPDATE Users SET username=?, password=?, role=?, department=?, designation=?, study_ids=?, status=? WHERE id=?",
                          (data.get('name'), hashed_pw, target_role, data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active'), item_id))
            else:
                c.execute("UPDATE Users SET username=?, role=?, department=?, designation=?, study_ids=?, status=? WHERE id=?",
                          (data.get('name'), target_role, data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active'), item_id))
        else:
            pw_to_hash = password_provided if password_provided else 'password123'
            hashed_pw = bcrypt.generate_password_hash(pw_to_hash).decode('utf-8')
            c.execute("INSERT INTO Users (username, password, role, department, designation, study_ids, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (data.get('name'), hashed_pw, target_role, data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT id, username AS user_name, role, department, designation, study_ids, status FROM Users")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/batches', methods=['GET', 'POST'])
def handle_batches():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        item_id = data.get('id')
        if item_id:
            c.execute("""UPDATE Physical_Batches SET inventory_id=?, po_number=?, lot_number=?, expiry_date=?, date_first_used=?, quantity_received=?, current_quantity=?, unit=?, status=?, remarks=? WHERE id=?""",
                      (data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), data.get('status', 'Active'), data.get('remarks', ''), item_id))
        else:
            c.execute("SELECT MAX(id) FROM Physical_Batches")
            max_id = c.fetchone()[0] or 0
            batch_code = f"BAT{str(max_id + 1).zfill(6)}"
            
            c.execute("""INSERT INTO Physical_Batches (batch_code, inventory_id, po_number, lot_number, expiry_date, date_first_used, quantity_received, current_quantity, unit, status, remarks) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (batch_code, data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    
    c.execute("SELECT * FROM Physical_Batches ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/vendors', methods=['GET', 'POST'])
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
def handle_usage():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized. Please log in again."}), 401

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
def handle_history():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized. Please log in again."}), 401

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
def export_db():
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    return send_file(DB_PATH, as_attachment=True, download_name=f'easybiovibe-backup-{stamp}.db')

@app.route('/api/import_db', methods=['POST'])
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


if __name__ == '__main__':
    frozen = getattr(sys, 'frozen', False)
    app.run(debug=not frozen, use_reloader=not frozen, host='127.0.0.1', port=5000)