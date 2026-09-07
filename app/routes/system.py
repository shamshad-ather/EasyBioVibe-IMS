import os
import datetime
from flask import Blueprint, request, jsonify, session, send_file
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
        for key in ['lab_name', 'lab_abbrev', 'system_mode', 'backup_path']:
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
    c.execute("SELECT id, name AS fac_name, code AS fac_code, department_id, status FROM Faculty")
    facs = [dict(r) for r in c.fetchall()]
    c.execute("SELECT id, name AS study_name, code AS study_code, type AS study_type, faculty_id, department_id, description, status FROM Studies")
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
    return send_file(DB_PATH, as_attachment=True, download_name=f"easybiovibe-backup-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.db")

@system_bp.route('/api/import_db', methods=['POST'])
@admin_required
def import_db():
    f = request.files.get('dbfile')
    if not f or f.read(16)[:15] != b'SQLite format 3': return jsonify({"status": "error", "message": "Invalid database file"}), 400
    f.seek(0)
    if os.path.exists(DB_PATH): 
        import shutil
        shutil.copy2(DB_PATH, DB_PATH + '.before-import')
    f.save(DB_PATH)
    return jsonify({"status": "success", "message": "Database imported. Restart the app."})