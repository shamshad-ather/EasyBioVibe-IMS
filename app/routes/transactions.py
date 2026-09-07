import datetime
from flask import Blueprint, request, jsonify, session
from app.database import get_db, trigger_backup
from app.utils import login_required, get_unit_multiplier

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
            c.execute("""INSERT INTO Physical_Batches (batch_code, inventory_id, po_number, lot_number, expiry_date, date_first_used, quantity_received, current_quantity, unit, department_id, study_id, vendor_id, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (f"BAT{str((c.fetchone()[0] or 0) + 1).zfill(6)}", data.get('inventory_id'), data.get('po_number', ''), data.get('lot_number', ''), data.get('expiry_date', ''), data.get('date_first_used', ''), data.get('quantity_received', 0), data.get('current_quantity', 0), data.get('unit', 'Nos'), int(data.get('department_id')) if data.get('department_id') else None, int(data.get('study_id')), int(data.get('vendor_id')) if data.get('vendor_id') else None, data.get('status', 'Active'), data.get('remarks', '')))
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
        
        c.execute("SELECT current_quantity, unit FROM Physical_Batches WHERE id = ?", (data.get('batch_id'),))
        batch = c.fetchone()
        if not batch: 
            conn.close()
            return jsonify({"status": "error", "message": "Batch not found"}), 400
            
        used_mult, used_fam = get_unit_multiplier(data.get('unit', ''))
        batch_mult, batch_fam = get_unit_multiplier(batch['unit'])
        
        if used_fam != batch_fam: 
            conn.close()
            return jsonify({"status": "error", "message": "Unit mismatch"}), 400
            
        norm_qty = (float(data.get('quantity_used', 0)) * used_mult) / batch_mult
        
        if float(batch['current_quantity']) < norm_qty: 
            conn.close()
            return jsonify({"status": "error", "message": "Insufficient stock."}), 400
            
        new_qty = round(max(0.0, float(batch['current_quantity']) - norm_qty), 4)
        c.execute("UPDATE Physical_Batches SET current_quantity = ?, status = ? WHERE id = ?", 
                  (new_qty, 'Active' if new_qty > 0 else 'Depleted', data.get('batch_id')))
        
        equip_val = data.get('equip_id')
        if equip_val: 
            equip_val = str(equip_val) 
        else:
            equip_val = None

        c.execute("""INSERT INTO Usage_Logs (username, inventory_id, batch_code, quantity_used, unit_used, timestamp, activity_type, department, faculty, study, user_id, batch_id, department_id, faculty_id, study_id, remarks, balance_after, recorded_by, equip_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                  (data.get('user_id', ''), data.get('inventory_id'), data.get('batch_code', ''), float(data.get('quantity_used', 0)), data.get('unit', ''), datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'Lab Usage', data.get('department_id', ''), data.get('faculty_id', ''), data.get('study_id', ''), data.get('user_id', ''), data.get('batch_id'), data.get('department_id', ''), data.get('faculty_id', ''), data.get('study_id', ''), data.get('remarks', ''), new_qty, session['user'], equip_val))
        
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
        c.execute("""INSERT INTO History_Logs (history_code, entity, entity_code, field_changed, old_value, new_value, changed_by, changed_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                  (f"HIS{str((c.fetchone()[0] or 0) + 1).zfill(6)}", data.get('entity', ''), data.get('entity_code', ''), data.get('field_changed', ''), data.get('old_value', ''), data.get('new_value', ''), session['user'], datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close(); trigger_backup()
        return jsonify({"status": "success"})
    c.execute("SELECT * FROM History_Logs ORDER BY id DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)
