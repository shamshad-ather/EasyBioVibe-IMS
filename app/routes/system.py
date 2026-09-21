import os
import shutil
import tempfile
import sqlite3
import datetime
from flask import Blueprint, request, jsonify, session, send_file, after_this_request
from app.database import get_db, trigger_backup, DB_PATH
from app.utils import get_app_version, login_required, admin_required

system_bp = Blueprint('system', __name__)

@system_bp.route('/api/status', methods=['GET'])
def system_status():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM Users")
    count = c.fetchone()[0]
    conn.close()
    return jsonify({"setup_required": count == 0, "logged_in": bool(session.get('user')), "username": session.get('user'), "role": session.get('role')})

@system_bp.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        if not session.get('user'): return jsonify({"status": "error", "message": "Not logged in"}), 401
        if session.get('role') != 'Admin': return jsonify({"status": "error", "message": "Admin privileges required"}), 403
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        for key in ['lab_name', 'lab_abbrev', 'system_mode', 'backup_path', 'institution_prefix']:
            if key in data: c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES (?, ?)", (key, data[key]))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM App_Settings")
    settings = {row['setting_key']: row['setting_value'] for row in c.fetchall()}
    conn.close()
    settings['app_version'] = get_app_version()
    return jsonify(settings)

@system_bp.route('/api/wizard_data', methods=['GET'])
@login_required
def wizard_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name AS dept_name, code AS dept_code, status, remarks FROM Departments")
    depts = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id, username AS fac_name, username AS fac_code, department, status FROM Users WHERE designation IN ('Faculty', 'HoD')")
    facs = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id, name AS study_name, code AS study_code, type AS study_type, pi_user_id AS faculty_id, department_id, description, status FROM Studies")
    studies = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id, username AS user_name, role, department, designation, study_ids, status FROM Users")
    users = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id, equip_code, name, make, status FROM Equipment_Master")
    equipment = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify({"departments": depts, "faculty": facs, "studies": studies, "users": users, "equipment": equipment})

@system_bp.route('/api/export_db', methods=['GET'])
@admin_required
def export_db():
    timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    temp_dir = tempfile.gettempdir()
    export_path = os.path.join(temp_dir, f"easybiovibe-backup-{timestamp}.db")
    try:
        conn = get_db()
        bck = sqlite3.connect(export_path)
        with bck:
            conn.backup(bck)
        bck.close()
        conn.close()

        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(export_path):
                    os.remove(export_path)
            except OSError:
                pass
            return response

        return send_file(export_path, as_attachment=True, download_name=f"easybiovibe-backup-{timestamp}.db")
    except Exception as e:
        if os.path.exists(export_path):
            try: os.remove(export_path)
            except OSError: pass
        return jsonify({"status": "error", "message": f"Export failed: {str(e)}"}), 500

@system_bp.route('/api/import_db', methods=['POST'])
@admin_required
def import_db():
    f = request.files.get('dbfile')
    if not f or f.read(16)[:15] != b'SQLite format 3': 
        return jsonify({"status": "error", "message": "Invalid SQLite database file"}), 400
    f.seek(0)
    
    # Save to temporary file first and validate required tables exist
    temp_import = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    f.save(temp_import.name)
    temp_import.close()
    
    try:
        test_conn = sqlite3.connect(temp_import.name)
        tc = test_conn.cursor()
        tc.execute("SELECT COUNT(*) FROM Users")
        tc.fetchone()
        test_conn.close()
    except Exception as e:
        if os.path.exists(temp_import.name): os.remove(temp_import.name)
        return jsonify({"status": "error", "message": f"Database file is incompatible or missing required tables: {str(e)}"}), 400

    try:
        if os.path.exists(DB_PATH): 
            shutil.copy2(DB_PATH, DB_PATH + '.before-import')
        # Use sqlite online backup into active DB path to respect file locks safely
        dest_conn = sqlite3.connect(DB_PATH)
        src_conn = sqlite3.connect(temp_import.name)
        with dest_conn:
            src_conn.backup(dest_conn)
        src_conn.close()
        dest_conn.close()
        if os.path.exists(temp_import.name): os.remove(temp_import.name)
        return jsonify({"status": "success", "message": "Database imported successfully. Please reload the page."})
    except Exception as e:
        if os.path.exists(temp_import.name): os.remove(temp_import.name)
        return jsonify({"status": "error", "message": f"Import failed: {str(e)}"}), 500

@system_bp.route('/api/pick_folder', methods=['POST'])
@admin_required
def pick_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title="Select Backup Directory")
        root.destroy()
        if folder:
            return jsonify({"status": "success", "path": folder})
        return jsonify({"status": "cancelled"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@system_bp.route('/api/system/migrate_ids', methods=['POST'])
@admin_required
def migrate_ids():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT setting_key, setting_value FROM App_Settings WHERE setting_key IN ('institution_prefix', 'lab_abbrev')")
    settings = {row['setting_key']: row['setting_value'] for row in c.fetchall()}
    
    inst = settings.get('institution_prefix', '')
    lab = settings.get('lab_abbrev', '')
    
    parts = []
    if inst: parts.append(inst)
    if lab: parts.append(lab)
    
    if not parts:
        conn.close()
        return jsonify({"status": "error", "message": "No institution or lab abbreviation set in settings."})
        
    prefix_str = "-".join(parts) + "-"
    
    tables_to_update = {
        'Inventory_Master': ('item_code', None),
        'Equipment_Master': ('equip_code', None),
        'Documents': ('document_code', None),
        'Physical_Batches': ('batch_code', 'Usage_Logs.batch_code')
    }
    
    total_updated = 0
    try:
        trigger_backup()
        for table, (col, related_col) in tables_to_update.items():
            c.execute(f"SELECT id, {col} FROM {table} WHERE {col} NOT LIKE ?", (f"{prefix_str}%",))
            rows = c.fetchall()
            for r in rows:
                old_code = r[col]
                new_code = f"{prefix_str}{old_code}"
                c.execute(f"UPDATE {table} SET {col} = ? WHERE id = ?", (new_code, r['id']))
                if related_col:
                    rel_table, rel_col = related_col.split('.')
                    c.execute(f"UPDATE {rel_table} SET {rel_col} = ? WHERE {rel_col} = ?", (new_code, old_code))
                c.execute("UPDATE History_Logs SET entity_code = ? WHERE entity_code = ?", (new_code, old_code))
                total_updated += 1
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": f"Migration failed: {str(e)}"}), 500
        
    conn.close()
    return jsonify({"status": "success", "message": f"Migrated {total_updated} legacy IDs."})