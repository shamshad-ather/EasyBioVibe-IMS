from flask import Blueprint, request, jsonify, session
from app import bcrypt
from app.database import get_db, trigger_backup
from app.utils import gen_code, login_required, admin_required

masters_bp = Blueprint('masters', __name__)

@masters_bp.route('/api/departments', methods=['GET', 'POST'])
@login_required
def handle_departments():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if data.get('id'): c.execute("UPDATE Departments SET name=?, status=?, remarks=? WHERE id=?", (data.get('name'), data.get('status', 'Active'), data.get('remarks', ''), data.get('id')))
        else: c.execute("INSERT INTO Departments (name, code, status, remarks) VALUES (?, ?, ?, ?)", (data.get('name'), data.get('code') or gen_code(data.get('name'), 'DEP'), data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Departments")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/faculty', methods=['GET', 'POST'])
@login_required
def handle_faculty():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if not data.get('id') and session.get('role') == 'Admin' and not data.get('password'): conn.close(); return jsonify({"status": "error", "message": "A login password must be explicitly provided."}), 400
        if data.get('id'): c.execute("UPDATE Faculty SET name=?, department_id=?, status=? WHERE id=?", (data.get('name'), data.get('department_id'), data.get('status', 'Active'), data.get('id')))
        else:
            c.execute("SELECT MAX(id) FROM Faculty")
            c.execute("INSERT INTO Faculty (name, code, department_id, status) VALUES (?, ?, ?, ?)", (data.get('name'), f"FAC{str((c.fetchone()[0] or 0) + 1).zfill(4)}", data.get('department_id'), data.get('status', 'Active')))
            if session.get('role') == 'Admin':
                try:
                    c.execute("SELECT name FROM Departments WHERE id=?", (data.get('department_id'),)); d = c.fetchone()
                    c.execute("""INSERT INTO Users (username, password, role, department, designation, study_ids, status, faculty_id, must_change_password) VALUES (?, ?, 'Manager', ?, 'Faculty', 'ALL', 'Active', ?, 1)""", (data.get('name'), bcrypt.generate_password_hash(data.get('password')).decode('utf-8'), d['name'] if d else '', c.lastrowid))
                except sqlite3.IntegrityError: pass
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Faculty")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/users', methods=['GET', 'POST'])
@login_required
def handle_users():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'Admin': conn.close(); return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        if not data.get('id') and not data.get('password'): conn.close(); return jsonify({"status": "error", "message": "A login password must be explicitly provided."}), 400
        study_ids_str = ",".join(map(str, data.get('study_ids', ['ALL']))) if isinstance(data.get('study_ids', ['ALL']), list) else str(data.get('study_ids', ['ALL']))
        if data.get('id'):
            if data.get('password'): c.execute("UPDATE Users SET username=?, password=?, role=?, department=?, designation=?, study_ids=?, status=?, must_change_password=0 WHERE id=?", (data.get('name'), bcrypt.generate_password_hash(data.get('password')).decode('utf-8'), data.get('role', 'Manager'), data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active'), data.get('id')))
            else: c.execute("UPDATE Users SET username=?, role=?, department=?, designation=?, study_ids=?, status=? WHERE id=?", (data.get('name'), data.get('role', 'Manager'), data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active'), data.get('id')))
        else: c.execute("INSERT INTO Users (username, password, role, department, designation, study_ids, status, must_change_password, qa_configured) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)", (data.get('name'), bcrypt.generate_password_hash(data.get('password')).decode('utf-8'), data.get('role', 'Manager'), data.get('department', ''), data.get('designation', 'Other'), study_ids_str, data.get('status', 'Active')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT id, username AS user_name, role, department, designation, study_ids, status FROM Users")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/studies', methods=['GET', 'POST'])
@login_required
def handle_studies():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if data.get('id'): c.execute("""UPDATE Studies SET name=?, type=?, faculty_id=?, department_id=?, description=?, status=? WHERE id=?""", (data.get('name'), data.get('type'), data.get('faculty_id'), data.get('department_id'), data.get('description', ''), data.get('status', 'Active'), data.get('id')))
        else: c.execute("""INSERT INTO Studies (name, code, type, faculty_id, department_id, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)""", (data.get('name'), data.get('code') or gen_code(data.get('name'), 'STD'), data.get('type'), data.get('faculty_id'), data.get('department_id'), data.get('description', ''), data.get('status', 'Active')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Studies")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/vendors', methods=['GET', 'POST'])
@login_required
def handle_vendors():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if data.get('id'): c.execute("UPDATE Vendors SET vendor_name=?, contact_number=?, remarks=? WHERE id=?", (data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', ''), data.get('id')))
        else: c.execute("INSERT INTO Vendors (vendor_code, vendor_name, contact_number, remarks) VALUES (?, ?, ?, ?)", (data.get('vendor_code'), data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Vendors ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/documents', methods=['GET', 'POST'])
@login_required
def handle_documents():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        l_inv = int(data.get('linked_inventory_id')) if data.get('linked_inventory_id') else None
        l_eq = int(data.get('linked_equip_id')) if data.get('linked_equip_id') else None
        
        if data.get('id'):
            c.execute("""UPDATE Documents SET title=?, document_type=?, version=?, linked_inventory_id=?, linked_equip_id=?, valid_from=?, valid_to=?, remarks=?, link_url=? WHERE id=?""",
                      (data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), l_inv, l_eq, data.get('valid_from') or None, data.get('valid_to') or None, data.get('remarks', ''), data.get('link_url', ''), data.get('id')))
        else:
            c.execute("""INSERT INTO Documents (document_code, title, document_type, version, linked_inventory_id, linked_equip_id, valid_from, valid_to, remarks, link_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (data.get('document_code'), data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), l_inv, l_eq, data.get('valid_from') or None, data.get('valid_to') or None, data.get('remarks', ''), data.get('link_url', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Documents ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)
