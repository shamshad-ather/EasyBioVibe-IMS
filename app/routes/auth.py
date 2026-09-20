import sqlite3
from flask import Blueprint, request, jsonify, session
from app import bcrypt
from app.database import get_db, trigger_backup
from app.utils import gen_code, normalize_answer, login_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/setup', methods=['POST'])
def setup_system():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM Users")
    if c.fetchone()[0] > 0:
        conn.close()
        return jsonify({"status": "error", "message": "System is already configured."})
    try:
        sys_mode = data.get('system_mode', 'Centralized')
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_name', ?)", (data.get('lab_name', 'Central Research Laboratory'),))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('lab_abbrev', ?)", (data.get('lab_abbrev', 'LAB'),))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('system_mode', ?)", (sys_mode,))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('backup_path', ?)", (data.get('backup_path', ''),))
        c.execute("INSERT OR REPLACE INTO App_Settings (setting_key, setting_value) VALUES ('institution_prefix', ?)", (data.get('institution_prefix', ''),))
        
        dept_name = "Main Lab" if sys_mode == 'Single' else data.get('department_name', 'Administration').strip()
        dept_code = gen_code(dept_name, 'DEP')
        c.execute("INSERT INTO Departments (name, code, status, remarks) VALUES (?, ?, 'Active', ?)", (dept_name, dept_code, 'Auto-created'))
        dept_id = c.lastrowid
        hashed_pw = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')
        c.execute("""INSERT INTO Users (username, password, role, department, designation, status, qa_configured) VALUES (?, ?, ?, ?, ?, ?, 0)""", 
                  (data.get('username'), hashed_pw, 'Admin', dept_name, data.get('designation', 'HoD'), 'Active'))
        conn.commit()
        session['user'] = data.get('username')
        session['role'] = 'Admin'
        status, message = "success", "Setup complete."
    except Exception as e:
        status, message = "error", str(e)
    conn.close()
    if status == "success": trigger_backup()
    return jsonify({"status": status, "message": message})

@auth_bp.route('/login', methods=['POST'])
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
        return jsonify({"status": "success", "role": user['role'], "username": data.get('username'), "must_change_password": bool(user['must_change_password']), "qa_configured": bool(user['qa_configured'])})
    return jsonify({"status": "error", "message": "Invalid username or password"}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"})

@auth_bp.route('/api/qa/setup', methods=['POST'])
@login_required
def qa_setup():
    data = request.get_json()
    if len({data.get('q1'), data.get('q2'), data.get('q3')}) != 3 or not all([data.get('a1'), data.get('a2'), data.get('a3')]): 
        return jsonify({"status": "error", "message": "Three unique questions and answers are required."}), 400
    a1_hash = bcrypt.generate_password_hash(normalize_answer(data.get('a1'))).decode('utf-8')
    a2_hash = bcrypt.generate_password_hash(normalize_answer(data.get('a2'))).decode('utf-8')
    a3_hash = bcrypt.generate_password_hash(normalize_answer(data.get('a3'))).decode('utf-8')
    conn = get_db()
    c = conn.cursor()
    c.execute("""UPDATE Users SET q1=?, a1_hash=?, q2=?, a2_hash=?, q3=?, a3_hash=?, qa_configured=1 WHERE username=?""", 
              (data.get('q1'), a1_hash, data.get('q2'), a2_hash, data.get('q3'), a3_hash, session['user']))
    conn.commit()
    conn.close()
    trigger_backup()
    return jsonify({"status": "success"})

@auth_bp.route('/api/qa/get_questions', methods=['POST'])
def qa_get_questions():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT role, qa_configured, q1, q2, q3 FROM Users WHERE username=? AND status='Active'", (data.get('username'),))
    user = c.fetchone()
    conn.close()
    if not user or user['role'] != 'Admin': return jsonify({"status": "error", "message": "Invalid recovery request."}), 400
    if not user['qa_configured']: return jsonify({"status": "error", "message": "This account does not have recovery questions configured."}), 400
    return jsonify({"status": "success", "q1": user['q1'], "q2": user['q2'], "q3": user['q3']})

@auth_bp.route('/api/qa/reset_password', methods=['POST'])
def qa_reset_password():
    data = request.get_json()
    if not data.get('new_password') or len(data.get('new_password')) < 6: return jsonify({"status": "error", "message": "Password must be at least 6 characters."}), 400
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, a1_hash, a2_hash, a3_hash FROM Users WHERE username=? AND status='Active' AND role='Admin'", (data.get('username'),))
    user = c.fetchone()
    if not user: conn.close(); return jsonify({"status": "error", "message": "Invalid recovery request."}), 400
    if not (bcrypt.check_password_hash(user['a1_hash'], normalize_answer(data.get('a1'))) and bcrypt.check_password_hash(user['a2_hash'], normalize_answer(data.get('a2'))) and bcrypt.check_password_hash(user['a3_hash'], normalize_answer(data.get('a3')))):
        conn.close(); return jsonify({"status": "error", "message": "Incorrect answers."}), 401
    c.execute("UPDATE Users SET password=?, must_change_password=0 WHERE id=?", (bcrypt.generate_password_hash(data.get('new_password')).decode('utf-8'), user['id']))
    conn.commit()
    conn.close()
    trigger_backup()
    return jsonify({"status": "success"})

@auth_bp.route('/api/profile', methods=['GET', 'POST'])
@login_required
def handle_profile():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM Users WHERE username=?", (session['user'],))
    me = c.fetchone()
    if not me: conn.close(); return jsonify({"status": "error", "message": "User not found"}), 404
    if request.method == 'POST':
        data = request.get_json()
        new_username = (data.get('name') or me['username']).strip()
        try:
            c.execute("UPDATE Users SET username=?, department=?, designation=? WHERE id=?", (new_username, data.get('department', me['department'] or ''), data.get('designation', me['designation'] or ''), me['id']))
            conn.commit()
            if new_username != session['user']: session['user'] = new_username
        except sqlite3.IntegrityError: conn.close(); return jsonify({"status": "error", "message": "That username is already taken"}), 400
        conn.close(); trigger_backup()
        return jsonify({"status": "success", "username": new_username})
    profile = {"id": me['id'], "name": me['username'], "role": me['role'], "status": me['status'], "department": me['department'] or '', "designation": me['designation'] or ''}
    conn.close()
    return jsonify(profile)

@auth_bp.route('/api/profile/password', methods=['POST'])
@login_required
def change_own_password():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM Users WHERE username=?", (session['user'],))
    me = c.fetchone()
    if not me or not bcrypt.check_password_hash(me['password'], data.get('current_password', '')): conn.close(); return jsonify({"status": "error", "message": "Current password is incorrect"}), 401
    c.execute("UPDATE Users SET password=?, must_change_password=0 WHERE id=?", (bcrypt.generate_password_hash(data.get('new_password', '')).decode('utf-8'), me['id']))
    conn.commit(); conn.close(); trigger_backup()
    return jsonify({"status": "success"})