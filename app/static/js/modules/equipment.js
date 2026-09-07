import { apiCall } from '../core/api.js';
import { DB, CONSTANTS, getLookup, generateId, loadRealData } from '../core/store.js';
import { escapeHtml, formatDate, showToast, openModal, closeModal } from '../core/utils.js';

export function renderEquipment(content) {
    const search = (document.getElementById('searchEquip')?.value || '').toLowerCase();
    const filterDept = document.getElementById('filterEquipDept')?.value || '';
    
    let items = DB.equipment;
    if (search) items = items.filter(e => e.name.toLowerCase().includes(search) || e.equip_code.toLowerCase().includes(search) || e.serial_number.toLowerCase().includes(search));
    if (filterDept && DB.settings.system_mode !== 'Single') items = items.filter(e => e.department_id === filterDept);

    content.innerHTML = `
        <h1 class="page-title">Equipment & Assets</h1>
        <p class="page-subtitle">Track hardware, installations, and document-driven compliance (Calibrations/AMCs)</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:300px;">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" class="form-control" id="searchEquip" placeholder="Search equipment..." value="${escapeHtml(search)}" oninput="renderCurrentPage()">
            </div>
            ${DB.settings.system_mode !== 'Single' ? `
            <select class="form-control" id="filterEquipDept" onchange="renderCurrentPage()">
                <option value="">All Departments</option>
                ${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${filterDept===d.id?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}
            </select>` : ''}
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openEquipmentModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Asset</button>` : ''}
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Asset Code & Name</th><th>Make / Model</th>${DB.settings.system_mode !== 'Single'?'<th>Department</th>':''}<th>Compliance Docs</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map((e, idx) => {
                    const dept = getLookup(e.department_id, 'departments');
                    return `<tr>
                        <td>${idx + 1}</td>
                        <td><div style="font-weight:600;">${escapeHtml(e.name)}</div><div class="code-display" style="display:inline-block;margin-top:4px;">${escapeHtml(e.equip_code)}</div></td>
                        <td><div style="font-size:12px;color:var(--gray-600);">${escapeHtml(e.make)}</div><div style="font-size:11px;color:var(--gray-500);">${escapeHtml(e.model)} <br> SN: ${escapeHtml(e.serial_number)}</div></td>
                        ${DB.settings.system_mode !== 'Single' ? `<td>${dept ? escapeHtml(dept.DepartmentName) : 'N/A'}</td>` : ''}
                        <td>${window.getEquipDueBadge(e.id)}</td>
                        <td>${window.getEquipStatusBadge(e.status)}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-primary" onclick="showEquipmentHistory('${e.id}')">Dossier</button>
                            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-sm btn-secondary" onclick="openEquipmentModal('${e.id}')">Edit</button>` : ''}
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

window.getEquipStatusBadge = function(status) {
    if (status === 'Active') return '<span class="badge badge-success">Active</span>';
    if (status === 'Quarantined') return '<span class="badge badge-danger">Quarantined</span>';
    if (status === 'Under Maintenance') return '<span class="badge badge-warning">Maintenance</span>';
    return `<span class="badge badge-gray">${status}</span>`;
};

window.getEquipDueBadge = function(equipId) {
    const docs = DB.documents.filter(d => d.LinkedEquipID === equipId && CONSTANTS.COMPLIANCE_DOCS.includes(d.DocumentType) && d.ValidTo).sort((a,b) => new Date(a.ValidTo) - new Date(b.ValidTo));
    if (docs.length === 0) return '<span class="badge badge-gray">No Compliance Docs</span>';
    
    const nextDueDoc = docs[0];
    const today = new Date();
    const due = new Date(nextDueDoc.ValidTo);
    const daysLeft = Math.ceil((due - today) / (1000*60*60*24));
    
    if (daysLeft < 0) return `<span class="badge badge-danger">Expired (${Math.abs(daysLeft)}d)</span>`;
    if (daysLeft <= 30) return `<span class="badge badge-warning">Due in ${daysLeft}d</span>`;
    return `<span class="badge badge-success">Valid</span>`;
};

window.openEquipmentModal = function(id) {
    const item = id ? getLookup(id, 'equipment') : null;
    const equipCode = item ? item.equip_code : generateId('EQP', 'equipment');
    
    openModal(item ? 'Edit Equipment' : 'Add Equipment', `
        <form id="equipForm" onsubmit="saveEquipment(event)">
            <div class="form-grid">
                <div class="form-group"><label>Equipment Code</label><input type="text" class="form-control" value="${equipCode}" disabled></div>
                <div class="form-group"><label>Asset Name <span class="required">*</span></label><input type="text" class="form-control" name="name" value="${item?escapeHtml(item.name):''}" required></div>
                <div class="form-group"><label>Make / Manufacturer</label><input type="text" class="form-control" name="make" value="${item?escapeHtml(item.make):''}"></div>
                <div class="form-group"><label>Model</label><input type="text" class="form-control" name="model" value="${item?escapeHtml(item.model):''}"></div>
                <div class="form-group"><label>Serial Number <span class="required">*</span></label><input type="text" class="form-control" name="serial_number" value="${item?escapeHtml(item.serial_number):''}" required></div>
                <div class="form-group"><label>Date of Installation</label><input type="date" class="form-control" name="installation_date" value="${item?item.installation_date:''}"></div>
                <div class="form-group" style="${DB.settings.system_mode === 'Single' ? 'display:none;' : ''}"><label>Department</label><select class="form-control" name="department_id"><option value="">Select Department</option>${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${item&&item.department_id===d.id?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Location / Room</label><input type="text" class="form-control" name="location_room" value="${item?escapeHtml(item.location_room):''}"></div>
                <div class="form-group full-width"><label>Faculty In Charge</label><input type="text" class="form-control" name="faculty_in_charge" value="${item?escapeHtml(item.faculty_in_charge):''}"></div>
                <div class="form-group full-width"><label>Operational Status</label><select class="form-control" name="status">${CONSTANTS.EQUIP_STATUSES.map(s=>`<option value="${s}" ${item&&item.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
            </div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('equipForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save Asset</button>`);
};

window.saveEquipment = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('equipForm')));
    const payload = {
        id: data.id ? parseInt(data.id) : null, name: data.name, make: data.make, model: data.model,
        serial_number: data.serial_number, department_id: data.department_id ? parseInt(data.department_id) : null,
        faculty_in_charge: data.faculty_in_charge, installation_date: data.installation_date, location_room: data.location_room, status: data.status
    };
    
    const res = await apiCall('/api/equipment', payload, 'POST');
    if (res.status === 'success') { 
        await loadRealData(); 
        showToast('Asset saved!', 'success'); 
        closeModal(); 
        window.renderCurrentPage(); 
    } else {
        showToast(res.message || 'Error saving equipment', 'error');
    }
};

window.showEquipmentHistory = function(equipId) {
    const eq = getLookup(equipId, 'equipment');
    const events = DB.equipmentEvents.filter(e => e.equip_id === equipId).sort((a,b) => new Date(b.event_date) - new Date(a.event_date));
    const complianceDocs = DB.documents.filter(d => d.LinkedEquipID === equipId && CONSTANTS.COMPLIANCE_DOCS.includes(d.DocumentType)).sort((a,b) => new Date(b.ValidTo) - new Date(a.ValidTo));
    const standardDocs = DB.documents.filter(d => d.LinkedEquipID === equipId && !CONSTANTS.COMPLIANCE_DOCS.includes(d.DocumentType));

    openModal(`Asset Dossier: ${escapeHtml(eq.name)}`, `
        <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                <div><span class="code-display" style="font-size:14px; padding:4px 10px;">${escapeHtml(eq.equip_code)}</span><span style="margin-left:8px;">SN: <strong>${escapeHtml(eq.serial_number)}</strong></span><span style="margin-left:8px;font-size:12px;color:var(--gray-500);">Installed: ${formatDate(eq.installation_date)||'N/A'}</span></div>
                <div>${window.getEquipStatusBadge(eq.status)}</div>
            </div>
            
            <h4 style="margin-top:24px; margin-bottom:12px; font-size:15px;">Compliance Documents & Contracts</h4>
            <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">Calibration, AMC, CMC, and IQ/OQ/PQ records driving the compliance status.</p>
            <div class="table-container">
                <table class="data-table history-table">
                    <thead><tr><th>Document</th><th>Type</th><th>Valid From</th><th>Valid To</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${complianceDocs.map(d => {
                            const daysLeft = Math.ceil((new Date(d.ValidTo) - new Date()) / (1000*60*60*24));
                            const statusCls = daysLeft < 0 ? 'low' : daysLeft <= 30 ? 'warning' : '';
                            return `<tr>
                                <td><strong>${escapeHtml(d.Title)}</strong> <span style="font-size:10px;color:var(--gray-500);">(${d.DocumentCode})</span></td>
                                <td><span class="badge badge-info">${d.DocumentType}</span></td>
                                <td>${formatDate(d.ValidFrom)}</td>
                                <td class="qty-display ${statusCls}">${formatDate(d.ValidTo) || '-'}</td>
                                <td>${d.LinkUrl ? `<a class="btn btn-sm btn-secondary" href="${escapeHtml(d.LinkUrl)}" target="_blank">View File</a>` : 'No Link'}</td>
                            </tr>`;
                        }).join('')}
                        ${complianceDocs.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gray-500);">No compliance documents linked. Add them via Documents tab.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; margin-bottom:12px;">
                <h4 style="font-size:15px;">Event & Action Log</h4>
                ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-sm btn-primary" onclick="openEventModal('${eq.id}')">Log Event</button>` : ''}
            </div>
            <div class="table-container">
                <table class="data-table history-table">
                    <thead><tr><th>Date</th><th>Event Type</th><th>Performed By</th><th>Result</th><th>Remarks</th></tr></thead>
                    <tbody>
                        ${events.map(e => `<tr>
                            <td>${formatDate(e.event_date)}</td>
                            <td><strong>${escapeHtml(e.event_type)}</strong></td>
                            <td>${escapeHtml(e.performed_by)}</td>
                            <td><span class="badge ${e.pass_fail_status==='Pass'?'badge-success':e.pass_fail_status==='Fail'?'badge-danger':'badge-gray'}">${escapeHtml(e.pass_fail_status)}</span></td>
                            <td>${escapeHtml(e.remarks)}</td>
                        </tr>`).join('')}
                        ${events.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gray-500);">No service events logged.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `, 'modal-xl');
};

window.openEventModal = function(equipId) {
    const today = new Date().toISOString().split('T')[0];
    openModal('Log Equipment Event', `
        <form id="eventForm" onsubmit="saveEvent(event)">
            <input type="hidden" name="equip_id" value="${equipId}">
            <div class="form-grid">
                <div class="form-group"><label>Event Type <span class="required">*</span></label><select class="form-control" name="event_type" required>${CONSTANTS.EVENT_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
                <div class="form-group"><label>Date <span class="required">*</span></label><input type="date" class="form-control" name="event_date" value="${today}" required></div>
                <div class="form-group"><label>Performed By (Internal/Vendor) <span class="required">*</span></label><input type="text" class="form-control" name="performed_by" required></div>
                <div class="form-group"><label>Result / Status</label><select class="form-control" name="pass_fail_status"><option value="Pass">Pass / Completed</option><option value="Fail">Fail / Defective</option><option value="Conditional">Conditional / Pending</option></select></div>
                <div class="form-group full-width"><label>Remarks</label><textarea class="form-control" name="remarks" rows="2"></textarea></div>
            </div>
            <p style="font-size:11px;color:var(--gray-500);margin-top:8px;">Note: Do not use this to set Calibration/AMC expiries. Instead, upload the Certificate/Contract via the Documents tab and assign validity dates there.</p>
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('eventForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save Event</button>`);
};

window.saveEvent = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('eventForm')));
    const res = await apiCall('/api/equipment/events', data, 'POST');
    if (res.status === 'success') { 
        await loadRealData(); showToast('Event logged!', 'success'); window.showEquipmentHistory(data.equip_id); window.renderCurrentPage(); 
    } else { showToast(res.message || 'Error saving event', 'error'); }
};