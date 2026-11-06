import sqlite3
from flask import Blueprint, request, jsonify, session
from app import bcrypt
from app.database import get_db, trigger_backup
from app.utils import gen_code, login_required, admin_required, generate_semantic_id

masters_bp = Blueprint('masters', __name__)

@masters_bp.route('/api/departments', methods=['GET', 'POST'])
@login_required
def handle_departments():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'Admin': conn.close(); return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        if data.get('id'): 
            c.execute("SELECT name FROM Departments WHERE id=?", (data.get('id'),))
            old_dept = c.fetchone()
            old_name = old_dept['name'] if old_dept else None
            new_name = data.get('name')
            
            c.execute("UPDATE Departments SET name=?, status=?, remarks=? WHERE id=?", 
                      (new_name, data.get('status', 'Active'), data.get('remarks', ''), data.get('id')))
            
            # Cascade Department name changes to Users and Usage_Logs
            if old_name and old_name != new_name:
                c.execute("UPDATE Users SET department=? WHERE department=?", (new_name, old_name))
                c.execute("UPDATE Usage_Logs SET department=? WHERE department=? OR department_id=?", (new_name, old_name, str(data.get('id'))))
        else:
            c.execute("SELECT MAX(id) FROM Departments")
            max_id = c.fetchone()[0] or 0
            code = data.get('code') or generate_semantic_id('DPT', max_id + 1, conn)
            c.execute("INSERT INTO Departments (name, code, status, remarks) VALUES (?, ?, ?, ?)", 
                      (data.get('name'), code, data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Departments")
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
        
        assigned_studies = data.get('study_ids', [])
        if isinstance(assigned_studies, str):
            assigned_studies = [assigned_studies]
            
        user_id = data.get('id')
        if user_id:
            c.execute("SELECT username, role, department FROM Users WHERE id=?", (user_id,))
            old_user_row = c.fetchone()
            old_role = old_user_row['role']
            old_username = old_user_row['username']
            old_dept = old_user_row['department']
            new_role = data.get('role', 'Manager')
            new_username = data.get('name')
            new_dept = data.get('department', '')
            qa_update = ", qa_configured=0" if (old_role != 'Admin' and new_role == 'Admin') else ""
            
            if data.get('password'): 
                c.execute(f"UPDATE Users SET username=?, password=?, role=?, department=?, designation=?, status=?, must_change_password=0{qa_update} WHERE id=?", 
                          (new_username, bcrypt.generate_password_hash(data.get('password')).decode('utf-8'), new_role, new_dept, data.get('designation', 'Other'), data.get('status', 'Active'), user_id))
            else: 
                c.execute(f"UPDATE Users SET username=?, role=?, department=?, designation=?, status=?{qa_update} WHERE id=?", 
                          (new_username, new_role, new_dept, data.get('designation', 'Other'), data.get('status', 'Active'), user_id))
            
            # Cascade User / Faculty name change
            if old_username and old_username != new_username:
                c.execute("UPDATE Usage_Logs SET username=? WHERE username=? OR user_id=?", (new_username, old_username, str(user_id)))
                c.execute("UPDATE Usage_Logs SET faculty=? WHERE faculty=? OR faculty_id=?", (new_username, old_username, str(user_id)))
                c.execute("UPDATE Equipment_Master SET faculty_in_charge=? WHERE faculty_in_charge=?", (new_username, old_username))

            # Cascade PI Department change to associated studies
            if old_dept != new_dept and new_dept:
                c.execute("SELECT id FROM Departments WHERE name=?", (new_dept,))
                dept_row = c.fetchone()
                if dept_row:
                    c.execute("UPDATE Studies SET department_id=? WHERE pi_user_id=?", (dept_row['id'], user_id))
            
            c.execute("DELETE FROM User_Study_Assignments WHERE user_id=?", (user_id,))
        else: 
            c.execute("INSERT INTO Users (username, password, role, department, designation, status, must_change_password, qa_configured) VALUES (?, ?, ?, ?, ?, ?, 1, 0)", 
                      (data.get('name'), bcrypt.generate_password_hash(data.get('password')).decode('utf-8'), data.get('role', 'Manager'), data.get('department', ''), data.get('designation', 'Other'), data.get('status', 'Active')))
            user_id = c.lastrowid
            
        if 'ALL' in assigned_studies:
            c.execute("SELECT id FROM Studies")
            for row in c.fetchall():
                c.execute("INSERT INTO User_Study_Assignments (user_id, study_id) VALUES (?, ?)", (user_id, row['id']))
        else:
            for sid in assigned_studies:
                if str(sid).isdigit():
                    c.execute("INSERT INTO User_Study_Assignments (user_id, study_id) VALUES (?, ?)", (user_id, int(sid)))
                    
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
        
    c.execute("SELECT id, username AS user_name, role, department, designation, status FROM Users")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/studies', methods=['GET', 'POST'])
@login_required
def handle_studies():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'Admin': conn.close(); return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        
        dept_id = data.get('department_id')
        pi_id = data.get('pi_user_id')
        
        # Directly map Department from PI when assigning PI in study if department_id is missing
        if not dept_id and pi_id:
            c.execute("SELECT department FROM Users WHERE id=?", (pi_id,))
            u_row = c.fetchone()
            if u_row and u_row['department']:
                c.execute("SELECT id FROM Departments WHERE name=?", (u_row['department'],))
                d_row = c.fetchone()
                if d_row:
                    dept_id = d_row['id']
                    
        if data.get('id'): 
            c.execute("SELECT name FROM Studies WHERE id=?", (data.get('id'),))
            old_study = c.fetchone()
            old_name = old_study['name'] if old_study else None
            new_name = data.get('name')
            
            c.execute("""UPDATE Studies SET name=?, type=?, pi_user_id=?, faculty_id=?, department_id=?, description=?, status=? WHERE id=?""", 
                      (new_name, data.get('type'), pi_id, pi_id, dept_id, data.get('description', ''), data.get('status', 'Active'), data.get('id')))
            
            # Cascade Study name change to Usage_Logs
            if old_name and old_name != new_name:
                c.execute("UPDATE Usage_Logs SET study=? WHERE study=? OR study_id=?", (new_name, old_name, str(data.get('id'))))
        else:
            c.execute("SELECT MAX(id) FROM Studies")
            max_id = c.fetchone()[0] or 0
            code = data.get('code') or generate_semantic_id('STU', max_id + 1, conn)
            c.execute("""INSERT INTO Studies (name, code, type, pi_user_id, faculty_id, department_id, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", 
                      (data.get('name'), code, data.get('type'), pi_id, pi_id, dept_id, data.get('description', ''), data.get('status', 'Active')))
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
        if session.get('role') != 'Admin': conn.close(); return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        if data.get('id'): 
            c.execute("UPDATE Vendors SET vendor_name=?, contact_number=?, remarks=? WHERE id=?", 
                      (data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', ''), data.get('id')))
        else: 
            c.execute("SELECT MAX(id) FROM Vendors")
            max_id = c.fetchone()[0] or 0
            code = data.get('vendor_code') or generate_semantic_id('VEN', max_id + 1, conn)
            c.execute("INSERT INTO Vendors (vendor_code, vendor_name, contact_number, remarks) VALUES (?, ?, ?, ?)", 
                      (code, data.get('vendor_name'), data.get('contact_number', ''), data.get('remarks', '')))
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
        if session.get('role') != 'Admin': conn.close(); return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        l_inv = int(data.get('linked_inventory_id')) if data.get('linked_inventory_id') else None
        l_eq = int(data.get('linked_equip_id')) if data.get('linked_equip_id') else None
        
        if data.get('id'):
            c.execute("""UPDATE Documents SET title=?, document_type=?, version=?, linked_inventory_id=?, linked_equip_id=?, valid_from=?, valid_to=?, remarks=?, link_url=?, file_path=? WHERE id=?""",
                      (data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), l_inv, l_eq, data.get('valid_from') or None, data.get('valid_to') or None, data.get('remarks', ''), data.get('link_url', ''), data.get('file_path', ''), data.get('id')))
        else:
            c.execute("SELECT MAX(id) FROM Documents")
            max_id = c.fetchone()[0] or 0
            code = data.get('document_code') or generate_semantic_id('DOC', max_id + 1, conn)
            c.execute("""INSERT INTO Documents (document_code, title, document_type, version, linked_inventory_id, linked_equip_id, valid_from, valid_to, remarks, link_url, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (code, data.get('title'), data.get('document_type'), data.get('version', 'v1.0'), l_inv, l_eq, data.get('valid_from') or None, data.get('valid_to') or None, data.get('remarks', ''), data.get('link_url', ''), data.get('file_path', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Documents ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/user_study_assignments', methods=['GET'])
@login_required
def get_user_study_assignments():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT user_id, study_id FROM User_Study_Assignments")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@masters_bp.route('/api/documents/upload', methods=['POST'])
@login_required
def upload_document():
    import os
    import werkzeug
    from app.__init__ import _DOCUMENTS_DIR
    
    if session.get('role') != 'Admin': 
        return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400
        
    doc_code = request.form.get('document_code', 'DOC_UNKNOWN')
    filename = werkzeug.utils.secure_filename(f"{doc_code}_{file.filename}")
    filepath = os.path.join(_DOCUMENTS_DIR, filename)
    
    file.save(filepath)
    return jsonify({"status": "success", "file_path": filename})

@masters_bp.route('/api/my_studies', methods=['GET'])
@login_required
def get_my_studies():
    conn = get_db()
    c = conn.cursor()
    if session.get('role') == 'Admin':
        c.execute("SELECT * FROM Studies WHERE status='Active'")
    else:
        c.execute("""SELECT s.* FROM Studies s 
                     JOIN User_Study_Assignments usa ON s.id = usa.study_id 
                     JOIN Users u ON usa.user_id = u.id
                     WHERE u.username = ? AND s.status='Active'""", (session.get('user'),))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)
