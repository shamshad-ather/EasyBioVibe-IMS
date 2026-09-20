import os
import sys
import re
from functools import wraps
from flask import session, jsonify

def resource_path(relative_path):
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        # Local development: point directly to the 'app' directory where utils.py lives
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

def get_app_version():
    # Because VERSION.md is in the root directory (one level above app/)
    try:
        if hasattr(sys, '_MEIPASS'):
            filepath = os.path.join(sys._MEIPASS, 'VERSION.md')
        else:
            filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'VERSION.md')
            
        if not os.path.exists(filepath):
            return "vUnknown"
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception:
        return "vUnknown"

def gen_code(name, fallback='GEN'):
    parts = [p for p in re.split(r'[\s\-_]+', (name or '').strip()) if p]
    if len(parts) >= 2:
        code = ''.join(p[0] for p in parts[:5]).upper()
    elif len(parts) == 1:
        code = parts[0][:4].upper()
    else:
        code = ''
    return code or fallback

def get_unit_multiplier(unit):
    mass_units = {'kg': 1000.0, 'g': 1.0, 'mg': 0.001, 'ug': 0.000001}
    vol_units = {'L': 1.0, 'mL': 0.001, 'uL': 0.000001}
    u = (unit or '').strip()
    if u in mass_units: return mass_units[u], 'mass'
    elif u in vol_units: return vol_units[u], 'vol'
    return 1.0, f'discrete_{u}'

def normalize_answer(ans):
    if not ans: return ""
    return re.sub(r'\s+', '', str(ans)).lower()

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

def generate_semantic_id(entity_prefix, sequential_id, conn):
    c = conn.cursor()
    c.execute("SELECT setting_key, setting_value FROM App_Settings WHERE setting_key IN ('institution_prefix', 'lab_abbrev')")
    settings = {row['setting_key']: row['setting_value'] for row in c.fetchall()}
    
    inst = settings.get('institution_prefix', '')
    lab = settings.get('lab_abbrev', '')
    
    parts = []
    if inst: parts.append(inst)
    if lab: parts.append(lab)
    
    number_str = str(sequential_id).zfill(3)
    parts.append(f"{entity_prefix}{number_str}")
    
    return "-".join(parts)