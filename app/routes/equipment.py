import sqlite3
from flask import Blueprint, request, jsonify, session
from app.database import get_db, trigger_backup
from app.utils import login_required, generate_semantic_id

equipment_bp = Blueprint('equipment', __name__)

@equipment_bp.route('/api/equipment', methods=['GET', 'POST'])
@login_required
def handle_equipment():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'Admin':
            conn.close()
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        data = request.get_json()
        try:
            if data.get('id'):
                c.execute("""UPDATE Equipment_Master SET name=?, make=?, model=?, serial_number=?, department_id=?, faculty_in_charge=?, installation_date=?, location_room=?, status=? WHERE id=?""",
                          (data.get('name'), data.get('make', ''), data.get('model', ''), data.get('serial_number', ''), data.get('department_id'), data.get('faculty_in_charge', ''), data.get('installation_date', ''), data.get('location_room', ''), data.get('status', 'Active'), data.get('id')))
            else:
                c.execute("SELECT MAX(id) FROM Equipment_Master")
                max_id = c.fetchone()[0] or 0
                code = data.get('equip_code') or generate_semantic_id('EQ', max_id + 1, conn)
                c.execute("""INSERT INTO Equipment_Master (equip_code, name, make, model, serial_number, department_id, faculty_in_charge, installation_date, location_room, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                          (code, data.get('name'), data.get('make', ''), data.get('model', ''), data.get('serial_number', ''), data.get('department_id'), data.get('faculty_in_charge', ''), data.get('installation_date', ''), data.get('location_room', ''), data.get('status', 'Active')))
            conn.commit()
            status, msg = "success", "Asset saved successfully"
        except sqlite3.IntegrityError as e:
            status, msg = "error", f"Database constraint violation: {str(e)}"
        except Exception as e:
            status, msg = "error", str(e)
        conn.close()
        if status == "success": trigger_backup()
        return jsonify({"status": status, "message": msg})
        
    c.execute("SELECT * FROM Equipment_Master ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@equipment_bp.route('/api/equipment/events', methods=['GET', 'POST'])
@login_required
def handle_equipment_events():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if not data.get('equip_id'): 
            conn.close()
            return jsonify({"status": "error", "message": "Equipment ID is required."}), 400
            
        if data.get('id'): 
            c.execute("""UPDATE Equipment_Events SET event_type=?, event_date=?, performed_by=?, pass_fail_status=?, remarks=? WHERE id=?""", 
                      (data.get('event_type'), data.get('event_date'), data.get('performed_by', ''), data.get('pass_fail_status', ''), data.get('remarks', ''), data.get('id')))
        else: 
            c.execute("""INSERT INTO Equipment_Events (equip_id, event_type, event_date, performed_by, pass_fail_status, remarks) VALUES (?, ?, ?, ?, ?, ?)""", 
                      (data.get('equip_id'), data.get('event_type'), data.get('event_date'), data.get('performed_by', ''), data.get('pass_fail_status', ''), data.get('remarks', '')))
        conn.commit()
        conn.close()
        trigger_backup()
        return jsonify({"status": "success"})
        
    c.execute("SELECT * FROM Equipment_Events ORDER BY event_date DESC, id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)