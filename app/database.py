import sqlite3
import os
import secrets
from pathlib import Path

_CACHE_DIR = os.path.join(Path.home(), '.cache', 'easybiovibe')
os.makedirs(_CACHE_DIR, exist_ok=True)

DB_PATH = os.path.join(_CACHE_DIR, 'easybiovibe.db')
_SECRET_KEY_PATH = os.path.join(_CACHE_DIR, 'secret.key')

def get_secret_key():
    if not os.path.exists(_SECRET_KEY_PATH):
        with open(_SECRET_KEY_PATH, 'w') as f:
            f.write(secrets.token_hex(32))
    with open(_SECRET_KEY_PATH, 'r') as f:
        return f.read().strip()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def trigger_backup():
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT setting_value FROM App_Settings WHERE setting_key='backup_path'")
        row = c.fetchone()
        if row and row['setting_value']:
            backup_dir = row['setting_value']
            if os.path.isdir(backup_dir):
                backup_file = os.path.join(backup_dir, 'easybiovibe_live_backup.db')
                bck = sqlite3.connect(backup_file)
                with bck:
                    conn.backup(bck)
                bck.close()
        conn.close()
    except Exception:
        pass

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # Core Application Tables
    c.execute('''CREATE TABLE IF NOT EXISTS App_Settings (setting_key TEXT PRIMARY KEY, setting_value TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT, department TEXT, study_ids TEXT, status TEXT DEFAULT 'Active')''')

    for col, col_type in [("faculty_id", "INTEGER"), ("designation", "TEXT"), ("must_change_password", "INTEGER DEFAULT 0"), ("qa_configured", "INTEGER DEFAULT 0"), ("q1", "TEXT"), ("a1_hash", "TEXT"), ("q2", "TEXT"), ("a2_hash", "TEXT"), ("q3", "TEXT"), ("a3_hash", "TEXT")]:
        try: c.execute(f"ALTER TABLE Users ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Inventory_Master (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT UNIQUE, material_name TEXT, make TEXT, model TEXT, category TEXT, pack_size REAL, base_unit TEXT, vendor_id INTEGER)''')
    for col, col_type in [("model", "TEXT"), ("alert_threshold", "REAL DEFAULT 15"), ("pack_qty", "REAL DEFAULT 1")]:
        try: c.execute(f"ALTER TABLE Inventory_Master ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass

    c.execute('''CREATE TABLE IF NOT EXISTS Physical_Batches (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_code TEXT, inventory_id INTEGER, po_number TEXT, lot_number TEXT, expiry_date TEXT, date_first_used TEXT, quantity_received REAL, current_quantity REAL, unit TEXT, department_id INTEGER, study_id INTEGER, status TEXT DEFAULT 'Active', remarks TEXT, FOREIGN KEY(inventory_id) REFERENCES Inventory_Master(id), FOREIGN KEY(department_id) REFERENCES Departments(id), FOREIGN KEY(study_id) REFERENCES Studies(id))''')
    for col, col_type in [("department_id", "INTEGER"), ("study_id", "INTEGER"), ("vendor_id", "INTEGER")]:
        try: c.execute(f"ALTER TABLE Physical_Batches ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Usage_Logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, inventory_id INTEGER, batch_code TEXT, quantity_used REAL, unit_used TEXT, timestamp TEXT, activity_type TEXT, department TEXT, faculty TEXT, study TEXT)''')
    for col, col_type in [("user_id", "TEXT"), ("batch_id", "INTEGER"), ("department_id", "TEXT"), ("faculty_id", "TEXT"), ("study_id", "TEXT"), ("remarks", "TEXT"), ("balance_after", "REAL"), ("recorded_by", "TEXT"), ("equip_id", "INTEGER")]:
        try: c.execute(f"ALTER TABLE Usage_Logs ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass
    
    c.execute('''CREATE TABLE IF NOT EXISTS Departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, status TEXT DEFAULT 'Active', remarks TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS Faculty (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, department_id INTEGER, status TEXT DEFAULT 'Active')''')
    c.execute('''CREATE TABLE IF NOT EXISTS Studies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT, type TEXT, faculty_id INTEGER, department_id INTEGER, description TEXT, status TEXT DEFAULT 'Active')''')
    c.execute('''CREATE TABLE IF NOT EXISTS Vendors (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor_code TEXT, vendor_name TEXT, contact_number TEXT, remarks TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS Documents (id INTEGER PRIMARY KEY AUTOINCREMENT, document_code TEXT, title TEXT, document_type TEXT, version TEXT, linked_inventory_id INTEGER, remarks TEXT)''')
    
    for col, col_type in [("link_url", "TEXT"), ("linked_equip_id", "INTEGER"), ("valid_from", "TEXT"), ("valid_to", "TEXT")]:
        try: c.execute(f"ALTER TABLE Documents ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass

    c.execute('''CREATE TABLE IF NOT EXISTS History_Logs (id INTEGER PRIMARY KEY AUTOINCREMENT, history_code TEXT, entity TEXT, entity_code TEXT, field_changed TEXT, old_value TEXT, new_value TEXT, changed_by TEXT, changed_date TEXT)''')

    # Equipment Module
    c.execute('''CREATE TABLE IF NOT EXISTS Equipment_Master (id INTEGER PRIMARY KEY AUTOINCREMENT, equip_code TEXT UNIQUE, name TEXT, make TEXT, model TEXT, serial_number TEXT, department_id INTEGER, faculty_in_charge TEXT, purchase_date TEXT, location_room TEXT, status TEXT DEFAULT 'Active')''')
    for col, col_type in [("installation_date", "TEXT")]:
        try: c.execute(f"ALTER TABLE Equipment_Master ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError: pass

    c.execute('''CREATE TABLE IF NOT EXISTS Equipment_Events (id INTEGER PRIMARY KEY AUTOINCREMENT, equip_id INTEGER, event_type TEXT, event_date TEXT, performed_by TEXT, pass_fail_status TEXT, remarks TEXT, FOREIGN KEY(equip_id) REFERENCES Equipment_Master(id))''')

    conn.commit()
    conn.close()