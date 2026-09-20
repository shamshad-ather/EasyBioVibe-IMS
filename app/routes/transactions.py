import datetime
from flask import Blueprint, request, jsonify, session
from app.database import get_db, trigger_backup
from app.utils import login_required, get_unit_multiplier, generate_semantic_id

transactions_bp = Blueprint('transactions', __name__)

@transactions_bp.route('/api/batches', methods=['GET', 'POST'])
@login_required
def handle_batches():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        if not data.get('study_id'): conn.close(); return jsonify({"status": "error", "message": "Study is strictly required."}), 400
        if data.get('id'):
            c.execute("""UPDATE Physical_Batches SET inventory_id=?, po_number=?, lot_number=?, expiry_date=?, date_first_used=?, quantity_received=?, current_quantity=?, unit=?, department_id=?, study_id=?, vendor_id=?, status=?, remarks=? WHERE id=?""",
                      (data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), int(data.get('department_id')) if data.get('department_id') else None, int(data.get('study_id')), int(data.get('vendor_id')) if data.get('vendor_id') else None, data.get('status', 'Active'), data.get('remarks', ''), data.get('id')))
        else:
            c.execute("SELECT MAX(id) FROM Physical_Batches")
            max_id = c.fetchone()[0] or 0
            code = generate_semantic_id('BAT', max_id + 1, conn)
            c.execute("""INSERT INTO Physical_Batches (batch_code, inventory_id, po_number, lot_number, expiry_date, date_first_used, quantity_received, current_quantity, unit, department_id, study_id, vendor_id, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (code, data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), int(data.get('department_id')) if data.get('department_id') else None, int(data.get('study_id')), int(data.get('vendor_id')) if data.get('vendor_id') else None, data.get('status', 'Active'), data.get('remarks', '')))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM Physical_Batches ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@transactions_bp.route('/api/usage', methods=['GET', 'POST'])
@login_required
def handle_usage():
    conn = get_db()
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.get_json()
        
        try:
            qty_used = float(data.get('quantity_used', 0))
            if qty_used <= 0:
                conn.close()
                return jsonify({"status": "error", "message": "Quantity used must be greater than zero."}), 400
        except (ValueError, TypeError):
            conn.close()
            return jsonify({"status": "error", "message": "Invalid quantity specified."}), 400
        
        c.execute("SELECT current_quantity, unit, batch_code FROM Physical_Batches WHERE id = ?", (data.get('batch_id'),))
        batch = c.fetchone()
        if not batch: 
            conn.close()
            return jsonify({"status": "error", "message": "Batch not found"}), 400
            
        used_mult, used_fam = get_unit_multiplier(data.get('unit', ''))
        batch_mult, batch_fam = get_unit_multiplier(batch['unit'])
        
        if used_fam != batch_fam: 
            conn.close()
            return jsonify({"status": "error", "message": f"Unit mismatch: cannot convert {data.get('unit', '')} to {batch['unit']}."}), 400
            
        norm_qty = (qty_used * used_mult) / batch_mult
        
        if float(batch['current_quantity']) < norm_qty: 
            conn.close()
            return jsonify({"status": "error", "message": f"Insufficient stock. Available: {batch['current_quantity']} {batch['unit']}, Requested: {norm_qty} {batch['unit']}"}), 400
            
        new_qty = round(max(0.0, float(batch['current_quantity']) - norm_qty), 4)
        c.execute("UPDATE Physical_Batches SET current_quantity = ?, status = ? WHERE id = ? AND current_quantity >= ?", 
                  (new_qty, 'Active' if new_qty > 0 else 'Depleted', data.get('batch_id'), norm_qty))
        if c.rowcount == 0:
            conn.rollback()
            conn.close()
            return jsonify({"status": "error", "message": "Stock update conflict. Please try again."}), 409
        
        user_id = str(data.get('user_id', '') or '')
        user_name = session.get('user', '')
        if user_id:
            c.execute("SELECT username FROM Users WHERE id = ? OR username = ?", (user_id, user_id))
            u_row = c.fetchone()
            if u_row: user_name = u_row['username']

        dept_id = str(data.get('department_id', '') or '')
        dept_name = ''
        if dept_id:
            c.execute("SELECT name FROM Departments WHERE id = ? OR name = ?", (dept_id, dept_id))
            d_row = c.fetchone()
            if d_row: dept_name = d_row['name']

        fac_id = str(data.get('pi_user_id', data.get('faculty_id', '')) or '')
        fac_name = ''
        if fac_id:
            c.execute("SELECT username FROM Users WHERE id = ? OR username = ?", (fac_id, fac_id))
            f_row = c.fetchone()
            if f_row: fac_name = f_row['username']

        std_id = str(data.get('study_id', '') or '')
        std_name = ''
        if std_id:
            c.execute("SELECT name FROM Studies WHERE id = ? OR name = ?", (std_id, std_id))
            s_row = c.fetchone()
            if s_row: std_name = s_row['name']

        equip_val = data.get('equip_id')
        equip_val = str(equip_val) if equip_val else None

        c.execute("""INSERT INTO Usage_Logs (username, inventory_id, batch_code, quantity_used, unit_used, timestamp, activity_type, department, faculty, study, user_id, batch_id, department_id, faculty_id, study_id, remarks, balance_after, recorded_by, equip_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                  (user_name, data.get('inventory_id'), batch['batch_code'] or data.get('batch_code', ''), qty_used, data.get('unit', ''), datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'Lab Usage', dept_name, fac_name, std_name, user_id, data.get('batch_id'), dept_id, fac_id, std_id, data.get('remarks', ''), new_qty, session.get('user', 'System'), equip_val))
        
        conn.commit()
        conn.close()
        trigger_backup()
        return jsonify({"status": "success"})
        
    c.execute("SELECT * FROM Usage_Logs ORDER BY id DESC LIMIT 100")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@transactions_bp.route('/api/history', methods=['GET', 'POST'])
@login_required
def handle_history():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.get_json()
        c.execute("SELECT MAX(id) FROM History_Logs")
        max_id = c.fetchone()[0] or 0
        code = generate_semantic_id('HIS', max_id + 1, conn)
        c.execute("""INSERT INTO History_Logs (history_code, entity, entity_code, field_changed, old_value, new_value, changed_by, changed_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                  (code, data.get('entity', ''), data.get('entity_code', ''), data.get('field_changed', ''), data.get('old_value', ''), data.get('new_value', ''), session['user'], datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM History_Logs ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)
