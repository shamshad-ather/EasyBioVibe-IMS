import { apiCall } from '../core/api.js';
import { DB, CONSTANTS, getLookup, generateId, loadRealData } from '../core/store.js';
import { escapeHtml, formatDate, showToast, openModal, closeModal } from '../core/utils.js';

// --- Global Audit Loggers ---
window.logHistory = async function(entity, entityCode, field, oldVal, newVal) {
    const payload = { entity: entity, entity_code: entityCode, field_changed: field, old_value: String(oldVal ?? ''), new_value: String(newVal ?? ''), changed_by: DB.settings.currentUser || DB.settings.currentRole };
    try { await apiCall('/api/history', payload, 'POST'); } catch (err) { console.error("Could not log history:", err); }
};

window.logChangedFields = async function(entity, entityCode, oldItem, newFields) {
    if (!oldItem) { const summary = Object.values(newFields)[0] || entityCode; await window.logHistory(entity, entityCode, '(created)', '', summary); return; }
    const calls = [];
    for (const [field, newVal] of Object.entries(newFields)) { 
        const oldStr = String(oldItem[field] ?? ''); const newStr = String(newVal ?? ''); 
        if (oldStr !== newStr) { calls.push(window.logHistory(entity, entityCode, field, oldStr, newStr)); } 
    }
    if (calls.length) await Promise.all(calls);
};

// --- Visual Drill Down (Stacks) ---
export function renderDepartmentStack(content) {
    const depts = DB.departments.filter(d => d.Status === 'Active');
    content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h1 class="page-title">Departments</h1><p class="page-subtitle">Select a department to view associated activities and inventory</p></div>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openDeptModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Department</button>` : ''}
        </div>
        <div class="stack-grid">
            ${depts.map(d => `<div class="home-card" style="padding:32px 24px;" onclick="navigateTo('facultyStack',{departmentId:'${d.id}'})">${DB.settings.currentRole === 'Admin' ? `<button class="edit-btn" onclick="event.stopPropagation(); openDeptModal('${d.id}')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}<div class="icon" style="background:var(--primary-light);color:var(--primary);width:48px;height:48px;"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div><h2 style="font-size:16px;">${escapeHtml(d.DepartmentName)}</h2><p style="font-size:12px;">${escapeHtml(d.DepartmentCode)}</p></div>`).join('')}
            ${depts.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">No active departments found.</div>' : ''}
        </div>
    `;
}

export function renderFacultyStack(content) {
    const dept = getLookup(window.drillContext.departmentId, 'departments');
    const facs = DB.faculty.filter(f => f.DepartmentID === window.drillContext.departmentId && f.Status === 'Active');
    content.innerHTML = `
        <div class="breadcrumb">${DB.settings.system_mode !== 'Single' ? `<a href="#" onclick="navigateTo('departmentStack')">Departments</a><span class="sep">/</span>` : `<a href="#" onclick="navigateTo('home')">Home</a><span class="sep">/</span>`}<span class="current">${DB.settings.system_mode !== 'Single' ? escapeHtml(dept ? dept.DepartmentName : '') : 'Faculty & Studies'}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h1 class="page-title">Faculty / Guides</h1><p class="page-subtitle">Select a PI to view their associated research studies</p></div>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openFacultyModal(null, '${window.drillContext.departmentId}')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Faculty</button>` : ''}
        </div>
        <div class="stack-grid">
            ${facs.map(f => `<div class="home-card" style="padding:32px 24px;" onclick="navigateTo('studyStack',{facultyId:'${f.id}'})">${DB.settings.currentRole === 'Admin' ? `<button class="edit-btn" onclick="event.stopPropagation(); openFacultyModal('${f.id}')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}<div class="icon" style="background:var(--success-light);color:var(--success);width:48px;height:48px;"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div><h2 style="font-size:16px;">${escapeHtml(f.FacultyName)}</h2><p style="font-size:12px;">${escapeHtml(f.FacultyCode)}</p></div>`).join('')}
            ${facs.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">No active faculty found in this department.</div>' : ''}
        </div>
    `;
}

export function renderStudyStack(content) {
    const dept = getLookup(window.drillContext.departmentId, 'departments'); const fac = getLookup(window.drillContext.facultyId, 'faculty'); const studies = DB.studies.filter(s => s.FacultyID === window.drillContext.facultyId && s.Status === 'Active');
    content.innerHTML = `
        <div class="breadcrumb">${DB.settings.system_mode !== 'Single' ? `<a href="#" onclick="navigateTo('departmentStack')">Departments</a><span class="sep">/</span><a href="#" onclick="navigateTo('facultyStack')">${escapeHtml(dept ? dept.DepartmentName : '')}</a>` : `<a href="#" onclick="navigateTo('facultyStack')">Faculty</a>`}<span class="sep">/</span><span class="current">${escapeHtml(fac ? fac.FacultyName : '')}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h1 class="page-title">Studies & Activities</h1><p class="page-subtitle">Select a study to view the materials used in it</p></div>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openStudyModal(null, '${window.drillContext.facultyId}')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Study</button>` : ''}
        </div>
        <div class="stack-grid">
            ${studies.map(s => `<div class="home-card" style="padding:32px 24px;" onclick="navigateTo('studyInventory',{studyId:'${s.id}'})">${DB.settings.currentRole === 'Admin' ? `<button class="edit-btn" onclick="event.stopPropagation(); openStudyModal('${s.id}')"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}<div class="icon" style="background:var(--warning-light);color:var(--warning);width:48px;height:48px;"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg></div><h2 style="font-size:16px;">${escapeHtml(s.StudyName)}</h2><p style="font-size:12px;"><span class="badge badge-info">${s.StudyType}</span> ${escapeHtml(s.StudyCode)}</p></div>`).join('')}
            ${studies.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">No active studies found for this PI.</div>' : ''}
        </div>
    `;
}

export function renderStudyInventory(content) {
    const dept = getLookup(window.drillContext.departmentId, 'departments'); const fac = getLookup(window.drillContext.facultyId, 'faculty'); const study = getLookup(window.drillContext.studyId, 'studies');
    const usagesForStudy = DB.usage.filter(u => u.StudyID === window.drillContext.studyId);
    const usedInventoryIds = [...new Set(usagesForStudy.map(u => u.InventoryID))];
    const items = DB.inventory.filter(i => usedInventoryIds.includes(i.id));

    content.innerHTML = `
        <div class="breadcrumb">${DB.settings.system_mode !== 'Single' ? `<a href="#" onclick="navigateTo('departmentStack')">Departments</a><span class="sep">/</span><a href="#" onclick="navigateTo('facultyStack')">${escapeHtml(dept ? dept.DepartmentName : '')}</a>` : `<a href="#" onclick="navigateTo('facultyStack')">Faculty</a>`}<span class="sep">/</span><a href="#" onclick="navigateTo('studyStack')">${escapeHtml(fac ? fac.FacultyName : '')}</a><span class="sep">/</span><span class="current">${escapeHtml(study ? study.StudyName : '')}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h1 class="page-title">Study Inventory</h1><p class="page-subtitle">Materials currently or previously used in ${escapeHtml(study ? study.StudyName : '')}</p></div>
            <button class="btn btn-primary" onclick="openGlobalUsageModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Record Usage</button>
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Name; Make; Model</th><th>Global Stock</th><th>Total Used (This Study)</th><th>Type</th><th>History</th></tr></thead>
            <tbody>
                ${items.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px;">No materials recorded for this study yet.</td></tr>' : items.map((item, idx) => {
                    const totalQty = window.getInventoryTotalQty(item.id);
                    const studyUsageQty = usagesForStudy.filter(u => u.InventoryID === item.id).reduce((sum, u) => sum + parseFloat(u.QuantityUsed), 0);
                    return `<tr>
                        <td>${idx + 1}</td>
                        <td><div style="font-weight:600;">${escapeHtml(item.MaterialName)}</div><div style="font-size:12px;color:var(--gray-500);">${escapeHtml(item.Make)} ${item.Model ? '| ' + escapeHtml(item.Model) : ''}</div></td>
                        <td><span class="qty-display">${totalQty} ${item.Unit}</span></td>
                        <td><span class="qty-display">${studyUsageQty.toFixed(2)} ${item.Unit}</span></td>
                        <td><span class="badge badge-gray">${item.MaterialType}</span></td>
                        <td><button class="btn btn-sm btn-secondary" onclick="showMaterialHistory('${item.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Log</button></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

// --- CRUD UI rendering functions ---

window.openDeptModal = function(id) {
    const item = id ? getLookup(id, 'departments') : null;
    openModal(item ? 'Edit Department' : 'Add Department', `
        <form id="deptForm" onsubmit="saveDept(event)">
            <div class="form-group"><label>Department Code</label><input type="text" class="form-control" value="${item?item.DepartmentCode:generateId('DEP','departments')}" disabled></div>
            <div class="form-group"><label>Department Name <span class="required">*</span></label><input type="text" class="form-control" name="DepartmentName" value="${item?escapeHtml(item.DepartmentName):''}" required></div>
            <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Inactive" ${item&&item.Status==='Inactive'?'selected':''}>Inactive</option></select></div>
            <div class="form-group"><label>Remarks</label><textarea class="form-control" name="Remarks" rows="2">${item?escapeHtml(item.Remarks):''}</textarea></div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('deptForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.saveDept = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('deptForm')));
    const item = data.id ? getLookup(data.id, 'departments') : null;
    const payload = { id: data.id ? parseInt(data.id) : null, name: data.DepartmentName, status: data.Status, remarks: data.Remarks || '' };
    try {
        const res = await apiCall('/api/departments', payload, 'POST');
        if (res.status === 'success') { const code = item ? item.DepartmentCode : payload.name; await window.logChangedFields('Department', code, item, { DepartmentName: payload.name, Status: payload.status, Remarks: payload.remarks }); await loadRealData(); showToast('Department saved successfully!', 'success'); closeModal(); window.renderCurrentPage(); } 
        else { showToast('Error saving department', 'error'); }
    } catch (err) { showToast('Connection error.', 'error'); }
};

export function renderFaculty(content) {
    const search = (document.getElementById('searchFac')?.value || '').toLowerCase();
    const filterDept = document.getElementById('filterFacDept')?.value || '';
    let items = DB.faculty;
    if (search) items = items.filter(f => f.FacultyName.toLowerCase().includes(search) || f.FacultyCode.toLowerCase().includes(search));
    if (filterDept && DB.settings.system_mode !== 'Single') items = items.filter(f => f.DepartmentID === filterDept);

    content.innerHTML = `
        <h1 class="page-title">Faculty Master</h1><p class="page-subtitle">Manage faculty and guides across all departments</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchFac" placeholder="Search faculty..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            ${DB.settings.system_mode !== 'Single' ? `<select class="form-control" id="filterFacDept" onchange="renderCurrentPage()"><option value="">All Departments</option>${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${filterDept===d.id?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}</select>` : ''}
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openFacultyModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Faculty</button>` : ''}
        </div>
        <div class="stack-grid" style="margin-top:20px;">
            ${items.map(f => {
                const dept = getLookup(f.DepartmentID, 'departments');
                return `
                <div class="home-card" style="padding:24px; text-align:left; position:relative; cursor:default;">
                    ${DB.settings.currentRole === 'Admin' ? `<button class="edit-btn" style="top:12px; right:12px;" onclick="openFacultyModal('${f.id}')" title="Edit"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <div class="icon" style="background:var(--success-light);color:var(--success);width:40px;height:40px; margin:0;"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>
                        <div>
                            <h3 style="font-size:15px; margin-bottom:2px; color:var(--gray-800);">${escapeHtml(f.FacultyName)}</h3>
                            <span class="code-display" style="font-size:11px;">${escapeHtml(f.FacultyCode)}</span>
                        </div>
                    </div>
                    <div style="font-size:12px; color:var(--gray-500); line-height:1.6;">
                        ${DB.settings.system_mode !== 'Single' ? `<strong>Dept:</strong> ${dept ? escapeHtml(dept.DepartmentName) : 'N/A'}<br>` : ''}
                        <strong>Status:</strong> <span class="badge ${f.Status==='Active'?'badge-success':'badge-gray'}">${f.Status}</span>
                    </div>
                </div>`;
            }).join('')}
            ${items.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">No faculty records found.</div>' : ''}
        </div>
    `;
}

window.openFacultyModal = function(id, preselectDeptId) {
    const item = id ? getLookup(id, 'faculty') : null;
    const singleDeptId = DB.departments.find(d => d.Status === 'Active')?.id || '';
    const targetDept = item ? item.DepartmentID : (DB.settings.system_mode === 'Single' ? singleDeptId : (preselectDeptId || ''));
    
    openModal(item ? 'Edit Faculty' : 'Add Faculty', `
        <form id="facultyForm" onsubmit="saveFaculty(event)">
            <div class="form-group"><label>Faculty Code</label><input type="text" class="form-control" value="${item?item.FacultyCode:generateId('FAC','faculty')}" disabled></div>
            <div class="form-group"><label>Faculty Name <span class="required">*</span></label><input type="text" class="form-control" name="FacultyName" value="${item?escapeHtml(item.FacultyName):''}" required></div>
            <div class="form-group" style="${DB.settings.system_mode === 'Single' ? 'display:none;' : ''}"><label>Department <span class="required">*</span></label><select class="form-control" name="DepartmentID" required>${DB.settings.system_mode === 'Single' ? `<option value="${singleDeptId}" selected>Main Lab</option>` : `<option value="">Select Department</option>${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${String(targetDept)===String(d.id)?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}`}</select></div>
            <hr style="margin:20px 0; border:none; border-top:1px solid var(--line);">
            <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--gray-700);">Login Credentials</p>
            <div class="form-group"><label>Login Password ${item ? '(Leave blank to keep current)' : '<span class="required">*</span>'}</label><input type="password" class="form-control" id="facPassword" name="password" minlength="6" ${item ? '' : 'required'}></div>
            <div class="form-group"><label>Confirm Password ${item ? '' : '<span class="required">*</span>'}</label><input type="password" class="form-control" id="facConfirmPassword" minlength="6" ${item ? '' : 'required'}></div>
            <hr style="margin:20px 0; border:none; border-top:1px solid var(--line);">
            <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Inactive" ${item&&item.Status==='Inactive'?'selected':''}>Inactive</option></select></div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('facultyForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.saveFaculty = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('facultyForm')));
    const pwd = document.getElementById('facPassword').value;
    const cpwd = document.getElementById('facConfirmPassword').value;
    if (pwd || cpwd) { if (pwd !== cpwd) { showToast('Passwords do not match!', 'error'); return; } }

    const item = data.id ? getLookup(data.id, 'faculty') : null;
    const payload = { id: data.id ? parseInt(data.id) : null, name: data.FacultyName, department_id: parseInt(data.DepartmentID), status: data.Status, password: pwd };

    try {
        const res = await apiCall('/api/faculty', payload, 'POST');
        if (res.status === 'success') {
            const code = item ? item.FacultyCode : payload.name;
            await window.logChangedFields('Faculty', code, item, { FacultyName: payload.name, DepartmentID: String(payload.department_id), Status: payload.status });
            await loadRealData(); showToast(res.message || 'Faculty saved successfully!', res.message && res.message.includes('already exists') ? 'error' : 'success'); closeModal(); window.renderCurrentPage();
        } else { showToast('Error saving faculty', 'error'); }
    } catch (err) { showToast('Connection error.', 'error'); }
};

export function renderStudies(content) {
    const search = (document.getElementById('searchStudy')?.value || '').toLowerCase();
    const filterType = document.getElementById('filterStudyType')?.value || '';
    const filterFac = document.getElementById('filterStudyFac')?.value || '';
    let items = DB.studies;
    if (search) items = items.filter(s => s.StudyName.toLowerCase().includes(search) || s.StudyCode.toLowerCase().includes(search));
    if (filterType) items = items.filter(s => s.StudyType === filterType);
    if (filterFac) items = items.filter(s => s.FacultyID === filterFac);

    content.innerHTML = `
        <h1 class="page-title">Studies / Activities Master</h1><p class="page-subtitle">Manage all research, diagnostic, and training activities centrally</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:250px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchStudy" placeholder="Search..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterStudyType" onchange="renderCurrentPage()"><option value="">All Types</option>${CONSTANTS.STUDY_TYPES.map(t=>`<option value="${t}" ${filterType===t?'selected':''}>${t}</option>`).join('')}</select>
            <select class="form-control" id="filterStudyFac" onchange="renderCurrentPage()"><option value="">All Faculty</option>${DB.faculty.filter(f=>f.Status==='Active').map(f=>`<option value="${f.id}" ${filterFac===f.id?'selected':''}>${escapeHtml(f.FacultyName)}</option>`).join('')}</select>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openStudyModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Study</button>` : ''}
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Name</th><th>Type</th><th>Faculty</th>${DB.settings.system_mode !== 'Single'?'<th>Department</th>':''}<th>Status</th>${DB.settings.currentRole === 'Admin'?'<th>Actions</th>':''}</tr></thead>
            <tbody>
                ${items.map((s, idx) => {
                    const fac = getLookup(s.FacultyID, 'faculty'); const dept = getLookup(s.DepartmentID, 'departments');
                    return `<tr><td>${idx + 1}</td><td>${escapeHtml(s.StudyName)}</td><td><span class="badge badge-info">${s.StudyType}</span></td><td>${fac?escapeHtml(fac.FacultyName):'N/A'}</td>${DB.settings.system_mode !== 'Single'?`<td>${dept?escapeHtml(dept.DepartmentName):'N/A'}</td>`:''}<td><span class="badge ${s.Status==='Active'?'badge-success':'badge-gray'}">${s.Status}</span></td>${DB.settings.currentRole === 'Admin' ? `<td class="table-actions"><button class="btn btn-sm btn-secondary" onclick="openStudyModal('${s.id}')">Edit</button></td>` : ''}</tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

window.openStudyModal = function(id, preselectFacId) {
    const item = id ? getLookup(id, 'studies') : null;
    const targetFac = item ? item.FacultyID : (preselectFacId || '');
    openModal(item ? 'Edit Study' : 'Add Study', `
        <form id="studyForm" onsubmit="saveStudy(event)">
            <div class="form-group"><label>Study Code</label><input type="text" class="form-control" value="${item?item.StudyCode:generateId('STD','studies')}" disabled></div>
            <div class="form-group"><label>Study Name <span class="required">*</span></label><input type="text" class="form-control" name="StudyName" value="${item?escapeHtml(item.StudyName):''}" required></div>
            <div class="form-group"><label>Study Type <span class="required">*</span></label><select class="form-control" name="StudyType" required>${CONSTANTS.STUDY_TYPES.map(t=>`<option value="${t}" ${item&&item.StudyType===t?'selected':''}>${t}</option>`).join('')}</select></div>
            <div class="form-group"><label>Faculty <span class="required">*</span></label><select class="form-control" name="FacultyID" required onchange="updateStudyDept()"><option value="">Select Faculty</option>${DB.faculty.filter(f=>f.Status==='Active').map(f=>`<option value="${f.id}" ${String(targetFac)===String(f.id)?'selected':''}>${escapeHtml(f.FacultyName)}</option>`).join('')}</select></div>
            <div class="form-group" style="${DB.settings.system_mode === 'Single' ? 'display:none;' : ''}"><label>Department</label><input type="text" class="form-control" id="studyDeptDisplay" value="${item?(getLookup(item.DepartmentID,'departments')?.DepartmentName||''):''}" disabled><input type="hidden" name="DepartmentID" id="studyDeptId" value="${item?item.DepartmentID:''}"></div>
            <div class="form-group"><label>Description</label><textarea class="form-control" name="Description" rows="2">${item?escapeHtml(item.Description):''}</textarea></div>
            <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Inactive" ${item&&item.Status==='Inactive'?'selected':''}>Inactive</option></select></div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('studyForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
    if (targetFac) window.updateStudyDept();
};

window.updateStudyDept = function() {
    const facId = document.querySelector('#studyForm [name="FacultyID"]').value;
    const fac = getLookup(facId, 'faculty');
    if (fac) { document.getElementById('studyDeptDisplay').value = getLookup(fac.DepartmentID, 'departments')?.DepartmentName || ''; document.getElementById('studyDeptId').value = fac.DepartmentID; }
};

window.saveStudy = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('studyForm')));
    const item = data.id ? getLookup(data.id, 'studies') : null;
    const payload = { id: data.id ? parseInt(data.id) : null, name: data.StudyName, type: data.StudyType, faculty_id: parseInt(data.FacultyID), department_id: parseInt(data.DepartmentID), description: data.Description || '', status: data.Status };

    try {
        const res = await apiCall('/api/studies', payload, 'POST');
        if (res.status === 'success') {
            const code = item ? item.StudyCode : payload.name;
            await window.logChangedFields('Study', code, item, { StudyName: payload.name, StudyType: payload.type, FacultyID: String(payload.faculty_id), DepartmentID: String(payload.department_id), Description: payload.description, Status: payload.status });
            await loadRealData(); showToast('Study saved successfully!', 'success'); closeModal(); window.renderCurrentPage();
        } else { showToast('Error saving study', 'error'); }
    } catch (err) { showToast('Connection error.', 'error'); }
};

export function renderUsers(content) {
    const search = (document.getElementById('searchUser')?.value || '').toLowerCase();
    const filterStudy = document.getElementById('filterUserStudy')?.value || '';
    let items = DB.users;
    if (search) items = items.filter(u => u.UserName.toLowerCase().includes(search) || u.UserCode.toLowerCase().includes(search));
    if (filterStudy) items = items.filter(u => u.StudyIDs && (u.StudyIDs.includes('ALL') || u.StudyIDs.includes(filterStudy)));

    content.innerHTML = `
        <h1 class="page-title">Users</h1><p class="page-subtitle">Manage laboratory users and assign them to specific studies</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchUser" placeholder="Search users..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterUserStudy" onchange="renderCurrentPage()"><option value="">All Studies</option>${DB.studies.filter(s=>s.Status==='Active').map(s=>`<option value="${s.id}" ${filterStudy===s.id?'selected':''}>${escapeHtml(s.StudyName)}</option>`).join('')}</select>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openUserModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add User</button>` : ''}
        </div>
        <div class="stack-grid" style="margin-top:20px;">
            ${items.map(u => {
                const isAll = u.StudyIDs && u.StudyIDs.includes('ALL');
                const studyCount = isAll ? 'Global Access (All Studies)' : (u.StudyIDs ? u.StudyIDs.length + ' Specific Studies' : 'None');
                return `
                <div class="home-card" style="padding:24px; text-align:left; position:relative; cursor:default;">
                    ${DB.settings.currentRole === 'Admin' ? `<button class="edit-btn" style="top:12px; right:12px;" onclick="openUserModal('${u.id}')" title="Edit"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <div class="icon" style="background:var(--primary-light);color:var(--primary);width:40px;height:40px; margin:0;"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                        <div>
                            <h3 style="font-size:15px; margin-bottom:2px; color:var(--gray-800);">${escapeHtml(u.UserName)}</h3>
                            <span class="code-display" style="font-size:11px;">${escapeHtml(u.UserCode)}</span>
                        </div>
                    </div>
                    <div style="font-size:12px; color:var(--gray-500); line-height:1.6;">
                        <strong>Role:</strong> <span class="badge badge-info">${u.Role}</span><br>
                        <strong>Designation:</strong> ${escapeHtml(u.Designation)}<br>
                        <strong>Access:</strong> ${studyCount}<br>
                        <strong>Status:</strong> <span class="badge ${u.Status==='Active'?'badge-success':'badge-gray'}">${u.Status}</span>
                    </div>
                </div>`;
            }).join('')}
            ${items.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">No user records found.</div>' : ''}
        </div>
    `;
}

window.toggleAllStudiesCheckboxes = function(allCb) { document.querySelectorAll('.study-checkbox').forEach(cb => { cb.checked = allCb.checked; }); };

window.openUserModal = function(id) {
    const item = id ? getLookup(id, 'users') : null;
    const userStudyIDs = item ? (item.StudyIDs || []) : [];
    const isAllSelected = userStudyIDs.includes('ALL');

    openModal(item ? 'Edit User' : 'Add User', `
        <form id="userForm" onsubmit="saveUser(event)">
            <div class="form-group"><label>User Code</label><input type="text" class="form-control" value="${item?item.UserCode:generateId('USR','users')}" disabled></div>
            <div class="form-group"><label>User Name <span class="required">*</span></label><input type="text" class="form-control" name="UserName" value="${item?escapeHtml(item.UserName):''}" required></div>
            <div class="form-group" style="${DB.settings.system_mode === 'Single' ? 'display:none;' : ''}"><label>Department</label><input type="text" class="form-control" name="Department" value="${item?escapeHtml(item.Department||''):''}"></div>
            <div class="form-group"><label>Designation</label><select class="form-control" name="Designation">${CONSTANTS.DESIGNATIONS.map(d => `<option value="${d}" ${item&&item.Designation===d?'selected':''}>${d}</option>`).join('')}</select></div>
            
            <hr style="margin:20px 0; border:none; border-top:1px solid var(--line);">
            <div class="form-group"><label>Password ${item ? '(Leave blank to keep current)' : '<span class="required">*</span>'}</label><input type="password" class="form-control" name="Password" id="userPassword" minlength="6" ${item ? '' : 'required'}></div>
            <div class="form-group"><label>Retype Password ${item ? '' : '<span class="required">*</span>'}</label><input type="password" class="form-control" id="userConfirmPassword" minlength="6" ${item ? '' : 'required'}></div>
            <hr style="margin:20px 0; border:none; border-top:1px solid var(--line);">

            <div class="form-group">
                <label>Assigned Studies <span class="required">*</span></label>
                <div style="max-height:160px; overflow-y:auto; border:1px solid var(--line); padding:10px; border-radius:var(--radius-md); background:var(--card-bg);">
                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-weight:600; cursor:pointer;"><input type="checkbox" name="StudyIDs" value="ALL" ${isAllSelected ? 'checked' : ''} onchange="toggleAllStudiesCheckboxes(this)"><span>All Studies (Global Access)</span></label>
                    <hr style="margin:6px 0; border:none; border-top:1px solid var(--line);">
                    ${DB.studies.filter(s=>s.Status==='Active').map(s=>`<label style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-weight:normal; cursor:pointer;"><input type="checkbox" class="study-checkbox" name="StudyIDs" value="${s.id}" ${isAllSelected || userStudyIDs.includes(s.id) ? 'checked' : ''}><span>${escapeHtml(s.StudyName)} (${s.StudyCode})</span></label>`).join('')}
                </div>
            </div>
            <div class="form-group"><label>Role</label><select class="form-control" name="Role">${CONSTANTS.ROLES.map(r=>`<option value="${r}" ${item&&item.Role===r?'selected':''}>${r}</option>`).join('')}</select></div>
            <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Inactive" ${item&&item.Status==='Inactive'?'selected':''}>Inactive</option></select></div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('userForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.saveUser = async function(e) {
    e.preventDefault();
    const pwd = document.getElementById('userPassword').value;
    const cpwd = document.getElementById('userConfirmPassword').value;
    if (pwd || cpwd) { if (pwd !== cpwd) { showToast('Passwords do not match!', 'error'); return; } }

    const formData = new FormData(document.getElementById('userForm'));
    const selectedStudies = formData.getAll('StudyIDs');
    const data = Object.fromEntries(formData);
    const item = data.id ? getLookup(data.id, 'users') : null;

    if (selectedStudies.length === 0) { showToast('Please select at least one study or "All Studies"', 'error'); return; }

    const payload = { id: data.id ? parseInt(data.id) : null, name: data.UserName, password: pwd || '', role: data.Role, department: data.Department, designation: data.Designation, study_ids: selectedStudies.includes('ALL') ? ['ALL'] : selectedStudies.map(id => parseInt(id)), status: data.Status };

    try {
        const res = await apiCall('/api/users', payload, 'POST');
        if (res.status === 'success') {
            const code = item ? item.UserName : payload.name;
            await window.logChangedFields('User', code, item, { UserName: payload.name, Role: payload.role, Status: payload.status, Department: payload.department, Designation: payload.designation });
            if (payload.password) { await window.logHistory('User', code, 'Password', '(hidden)', '(changed)'); }
            await loadRealData(); showToast('User saved successfully!', 'success'); closeModal(); window.renderCurrentPage();
        } else { showToast(res.message || 'Error saving user', 'error'); }
    } catch (err) { showToast('Connection error.', 'error'); }
};

export function renderVendors(content) {
    const search = (document.getElementById('searchVendor')?.value || '').toLowerCase();
    let items = DB.vendors;
    if (search) items = items.filter(v => v.VendorName.toLowerCase().includes(search) || v.VendorCode.toLowerCase().includes(search));

    content.innerHTML = `
        <h1 class="page-title">Vendors</h1><p class="page-subtitle">Manage supplier information</p>
        <div class="filters-bar"><div class="search-box" style="max-width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchVendor" placeholder="Search vendors..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openVendorModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Vendor</button>` : ''}</div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>Vendor Name</th><th>Contact</th><th>Remarks</th>${DB.settings.currentRole === 'Admin'?'<th>Actions</th>':''}</tr></thead>
            <tbody>${items.map((v, idx) => `<tr><td>${escapeHtml(v.VendorName)}</td><td>${escapeHtml(v.ContactNumber)}</td><td>${escapeHtml(v.Remarks)}</td>${DB.settings.currentRole === 'Admin' ? `<td class="table-actions"><button class="btn btn-sm btn-secondary" onclick="openVendorModal('${v.id}')">Edit</button></td>` : ''}</tr>`).join('')}</tbody>
        </table></div></div>
    `;
}

window.openVendorModal = function(id) {
    const item = id ? getLookup(id, 'vendors') : null;
    openModal(item ? 'Edit Vendor' : 'Add Vendor', `
        <form id="vendorForm" onsubmit="saveVendor(event)">
            <div class="form-group"><label>Vendor Code</label><input type="text" class="form-control" value="${item?item.VendorCode:generateId('VEN','vendors')}" disabled></div>
            <div class="form-group"><label>Vendor Name <span class="required">*</span></label><input type="text" class="form-control" name="VendorName" value="${item?escapeHtml(item.VendorName):''}" required></div>
            <div class="form-group"><label>Contact Number</label><input type="text" class="form-control" name="ContactNumber" value="${item?escapeHtml(item.ContactNumber):''}"></div>
            <div class="form-group"><label>Remarks</label><textarea class="form-control" name="Remarks" rows="2">${item?escapeHtml(item.Remarks):''}</textarea></div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('vendorForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.saveVendor = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('vendorForm')));
    const item = data.id ? getLookup(data.id, 'vendors') : null;
    const payload = { id: data.id ? parseInt(data.id) : null, vendor_code: data.VendorCode || generateId('VEN', 'vendors'), vendor_name: data.VendorName, contact_number: data.ContactNumber || '', remarks: data.Remarks || '' };
    try {
        const res = await apiCall('/api/vendors', payload, 'POST');
        if (res.status === 'success') { await window.logChangedFields('Vendor', item ? item.VendorCode : payload.vendor_name, item, { VendorName: payload.vendor_name, ContactNumber: payload.contact_number, Remarks: payload.remarks }); await loadRealData(); showToast('Saved!', 'success'); closeModal(); window.renderCurrentPage(); }
    } catch (err) {}
};

export function renderDocuments(content) {
    const search = (document.getElementById('searchDoc')?.value || '').toLowerCase();
    const filterType = document.getElementById('filterDocType')?.value || '';
    let items = DB.documents;
    if (search) items = items.filter(d => d.Title.toLowerCase().includes(search) || d.DocumentCode.toLowerCase().includes(search));
    if (filterType) items = items.filter(d => d.DocumentType === filterType);

    content.innerHTML = `
        <h1 class="page-title">Documents & Compliance</h1><p class="page-subtitle">SOPs, SDS, Certificates, Contracts, and Protocols</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchDoc" placeholder="Search documents..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterDocType" onchange="renderCurrentPage()"><option value="">All Types</option>${CONSTANTS.DOC_TYPES.map(t=>`<option value="${t}" ${filterType===t?'selected':''}>${t}</option>`).join('')}</select>
            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-primary" onclick="openDocumentModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Document</button>` : ''}
        </div>
        <div class="card"><div class="card-body"><div class="doc-list">
            ${items.map(d => {
                const inv = getLookup(d.LinkedInventoryID, 'inventory'); const eq = getLookup(d.LinkedEquipID, 'equipment');
                return `<div class="doc-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--line);">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="color:var(--gray-400);"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
                        <div>
                            <div style="font-weight:600;">${escapeHtml(d.Title)} <span class="code-display" style="font-size:10px;">${d.DocumentCode}</span></div>
                            <div style="font-size:12px; color:var(--gray-500); margin-top:4px;">
                                <span class="badge badge-info">${d.DocumentType}</span> <span style="margin-left:8px;">Ver: ${escapeHtml(d.Version)}</span>
                                ${d.ValidTo ? `<span style="margin-left:8px; border-left:1px solid var(--gray-200); padding-left:8px;">Valid: ${formatDate(d.ValidFrom)} to <strong style="color:var(--primary);">${formatDate(d.ValidTo)}</strong></span>` : ''}
                                ${inv ? `<span style="margin-left:8px; border-left:1px solid var(--gray-200); padding-left:8px;">Mat: ${escapeHtml(inv.MaterialName)}</span>` : ''}
                                ${eq ? `<span style="margin-left:8px; border-left:1px solid var(--gray-200); padding-left:8px;">Eq: ${escapeHtml(eq.name)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="table-actions">
                        ${d.LinkUrl ? `<a class="btn btn-sm btn-secondary" href="${escapeHtml(d.LinkUrl)}" target="_blank">Open Link</a>` : ''}
                        ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-sm btn-secondary" onclick="openDocumentModal('${d.id}')">Edit</button>` : ''}
                    </div>
                </div>`;
            }).join('')}
            ${items.length === 0 ? '<div class="empty-state" style="padding:40px; text-align:center; color:var(--gray-500);"><p>No documents found</p></div>' : ''}
        </div></div></div>
    `;
}

window.openDocumentModal = function(id) {
    const item = id ? getLookup(id, 'documents') : null;
    openModal(item ? 'Edit Document' : 'Add Document', `
        <form id="documentForm" onsubmit="saveDocument(event)">
            <div class="form-grid">
                <div class="form-group"><label>Document Code</label><input type="text" class="form-control" value="${item?item.DocumentCode:generateId('DOC','documents')}" disabled></div>
                <div class="form-group"><label>Title <span class="required">*</span></label><input type="text" class="form-control" name="Title" value="${item?escapeHtml(item.Title):''}" required></div>
                <div class="form-group"><label>Document Type <span class="required">*</span></label><select class="form-control" name="DocumentType" required>${CONSTANTS.DOC_TYPES.map(t=>`<option value="${t}" ${item&&item.DocumentType===t?'selected':''}>${t}</option>`).join('')}</select></div>
                <div class="form-group"><label>Version</label><input type="text" class="form-control" name="Version" value="${item?escapeHtml(item.Version):'v1.0'}"></div>
                <div class="form-group"><label>Valid From (Optional)</label><input type="date" class="form-control" name="ValidFrom" value="${item?item.ValidFrom:''}"></div>
                <div class="form-group"><label>Valid To / Expiry (Optional)</label><input type="date" class="form-control" name="ValidTo" value="${item?item.ValidTo:''}"></div>
                <div class="form-group"><label>Linked Material</label><select class="form-control" name="LinkedInventoryID"><option value="">None</option>${DB.inventory.filter(i=>i.Status==='Active').map(i=>`<option value="${i.id}" ${item&&item.LinkedInventoryID===i.id?'selected':''}>${escapeHtml(i.MaterialName)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Linked Equipment</label><select class="form-control" name="LinkedEquipID"><option value="">None</option>${DB.equipment.map(e=>`<option value="${e.id}" ${item&&item.LinkedEquipID===e.id?'selected':''}>${escapeHtml(e.name)}</option>`).join('')}</select></div>
                <div class="form-group full-width"><label>Link (Drive / intranet URL to the actual file)</label><input type="url" class="form-control" name="LinkUrl" placeholder="https://..." value="${item?escapeHtml(item.LinkUrl||''):''}"></div>
                <div class="form-group full-width"><label>Remarks</label><textarea class="form-control" name="Remarks" rows="2">${item?escapeHtml(item.Remarks):''}</textarea></div>
            </div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('documentForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.saveDocument = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('documentForm')));
    const item = data.id ? getLookup(data.id, 'documents') : null;
    const payload = { id: data.id ? parseInt(data.id) : null, document_code: data.DocumentCode || generateId('DOC', 'documents'), title: data.Title, document_type: data.DocumentType, version: data.Version || 'v1.0', linked_inventory_id: data.LinkedInventoryID || null, linked_equip_id: data.LinkedEquipID || null, valid_from: data.ValidFrom || null, valid_to: data.ValidTo || null, remarks: data.Remarks || '', link_url: data.LinkUrl || '' };
    try {
        const res = await apiCall('/api/documents', payload, 'POST');
        if (res.status === 'success') { const code = item ? item.DocumentCode : payload.document_code; if (!item) { await window.logHistory('Document', code, '(created)', '', payload.title); } else { await window.logChangedFields('Document', code, item, { Title: payload.title, DocumentType: payload.document_type, Version: payload.version, LinkUrl: payload.link_url, ValidTo: payload.valid_to }); } await loadRealData(); showToast('Saved!', 'success'); closeModal(); window.renderCurrentPage(); }
    } catch (err) {}
};

export function renderHistoryLog(content) {
    const search = (document.getElementById('searchHist')?.value || '').toLowerCase();
    const filterEntity = document.getElementById('filterHistEntity')?.value || '';
    const fromDate = document.getElementById('histFrom')?.value || '';
    const toDate = document.getElementById('histTo')?.value || '';
    
    let items = [...DB.historyLog].sort((a,b) => new Date(b.ChangedDate) - new Date(a.ChangedDate));
    if (search) items = items.filter(h => h.Entity.toLowerCase().includes(search) || h.EntityCode.toLowerCase().includes(search));
    if (filterEntity) items = items.filter(h => h.Entity === filterEntity);
    if (fromDate) items = items.filter(h => h.ChangedDate.split(' ')[0] >= fromDate);
    if (toDate) items = items.filter(h => h.ChangedDate.split(' ')[0] <= toDate);

    content.innerHTML = `
        <h1 class="page-title">History Log</h1><p class="page-subtitle">Audit trail of all changes</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:250px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchHist" placeholder="Search history..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterHistEntity" onchange="renderCurrentPage()"><option value="">All Entities</option><option value="Department" ${filterEntity==='Department'?'selected':''}>Department</option><option value="Faculty" ${filterEntity==='Faculty'?'selected':''}>Faculty</option><option value="Study" ${filterEntity==='Study'?'selected':''}>Study</option><option value="User" ${filterEntity==='User'?'selected':''}>User</option><option value="Inventory" ${filterEntity==='Inventory'?'selected':''}>Inventory</option><option value="Batch" ${filterEntity==='Batch'?'selected':''}>Batch</option><option value="Usage" ${filterEntity==='Usage'?'selected':''}>Usage</option><option value="Equipment" ${filterEntity==='Equipment'?'selected':''}>Equipment</option></select>
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">FROM</span><input type="date" class="form-control" id="histFrom" value="${fromDate}" onchange="renderCurrentPage()"></div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">TO</span><input type="date" class="form-control" id="histTo" value="${toDate}" onchange="renderCurrentPage()"></div>
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Code</th><th>Entity</th><th>Entity Info</th><th>Field</th><th>Old Value</th><th>New Value</th><th>Changed By</th><th>Date</th></tr></thead>
            <tbody>
                ${items.map((h, idx) => {
                    let displayName = h.EntityCode;
                    if (h.Entity === 'Department' && displayName.startsWith('DEP')) { const d = DB.departments.find(x => x.DepartmentCode === displayName); if(d) displayName = d.DepartmentName; } 
                    else if (h.Entity === 'Faculty' && displayName.startsWith('FAC')) { const f = DB.faculty.find(x => x.FacultyCode === displayName); if(f) displayName = f.FacultyName; } 
                    else if (h.Entity === 'Inventory' && displayName.startsWith('INV')) { const i = DB.inventory.find(x => x.InventoryCode === displayName); if(i) displayName = i.MaterialName; } 
                    else if (h.Entity === 'Study' && displayName.startsWith('STD')) { const s = DB.studies.find(x => x.StudyCode === displayName); if(s) displayName = s.StudyName; }
                    else if (h.Entity === 'Equipment' && displayName.startsWith('EQP')) { const e = DB.equipment.find(x => x.equip_code === displayName); if(e) displayName = e.name; }
                    return `<tr><td>${idx + 1}</td><td><span class="code-display">${h.HistoryCode}</span></td><td><span class="badge badge-gray">${h.Entity}</span></td><td><span style="font-weight:500;">${escapeHtml(displayName)}</span></td><td>${escapeHtml(h.FieldChanged)}</td><td style="color:var(--gray-500);font-size:12px;">${escapeHtml(h.OldValue)}</td><td style="color:var(--success);font-size:12px;font-weight:500;">${escapeHtml(h.NewValue)}</td><td>${escapeHtml(h.ChangedBy)}</td><td>${formatDate(h.ChangedDate)}</td></tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

export function renderGlobalUsage(content) {
    const search = (document.getElementById('searchUsage')?.value || '').toLowerCase();
    const fromDate = document.getElementById('usageFrom')?.value || '';
    const toDate = document.getElementById('usageTo')?.value || '';
    
    let items = [...DB.usage].sort((a,b) => new Date(b.UsageDate) - new Date(a.UsageDate));
    if (search) items = items.filter(u => { const inv = getLookup(u.InventoryID, 'inventory'); const user = getLookup(u.UserID, 'users'); return (inv && inv.MaterialName.toLowerCase().includes(search)) || (user && user.UserName.toLowerCase().includes(search)) || u.BatchCode.toLowerCase().includes(search); });
    if (fromDate) items = items.filter(u => u.UsageDate >= fromDate);
    if (toDate) items = items.filter(u => u.UsageDate <= toDate);

    content.innerHTML = `
        <div class="breadcrumb"><a href="#" onclick="navigateTo('home')">Home</a><span class="sep">/</span><span class="current">Global Usage Records</span></div>
        <h1 class="page-title">Usage Records</h1><p class="page-subtitle">Complete log of all material consumption</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchUsage" placeholder="Search material, user, batch..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">FROM</span><input type="date" class="form-control" id="usageFrom" value="${fromDate}" onchange="renderCurrentPage()"></div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">TO</span><input type="date" class="form-control" id="usageTo" value="${toDate}" onchange="renderCurrentPage()"></div>
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Date & Time</th><th>Material Detail</th><th>Batch</th><th>Used By</th><th>Recorded By</th><th>Study</th><th>Equipment Used</th><th>Qty Used</th><th>Balance</th></tr></thead>
            <tbody>
                ${items.map((u, idx) => {
                    const inv = getLookup(u.InventoryID, 'inventory'); const user = getLookup(u.UserID, 'users'); const study = getLookup(u.StudyID, 'studies'); const batch = getLookup(u.BatchID, 'batches');
                    
                    let eqNames = '<span style="color:var(--gray-400);">-</span>';
                    if (u.EquipID && u.EquipID !== 'null') {
                        const names = String(u.EquipID).split(',').map(id => {
                            const eq = getLookup(id.trim(), 'equipment');
                            return eq ? `${escapeHtml(eq.name)} (${escapeHtml(eq.equip_code)})` : null;
                        }).filter(Boolean);
                        if (names.length > 0) eqNames = names.join(', ');
                    }

                    const balanceLabel = (u.Balance !== null && u.Balance !== undefined) ? (u.Balance + ' ' + (batch ? batch.Unit : u.Unit)) : 'N/A';
                    return `<tr><td>${idx + 1}</td><td>${formatDate(u.UsageDate)}<br><span style="font-size:11px;color:var(--gray-400);">${u.UsageTime}</span></td><td><div style="font-weight:600;">${inv ? escapeHtml(inv.MaterialName) : 'N/A'}</div><div style="font-size:11px;color:var(--gray-500);">${inv ? escapeHtml(inv.Make) + (inv.Model ? ' | ' + escapeHtml(inv.Model) : '') : ''}</div></td><td><span class="code-display">${escapeHtml(u.BatchCode)}</span></td><td>${user ? escapeHtml(user.UserName) : 'N/A'}</td><td><span class="badge badge-gray">${escapeHtml(u.RecordedBy)}</span></td><td>${study ? escapeHtml(study.StudyName) : 'N/A'}</td><td>${eqNames}</td><td class="qty-display">${u.QuantityUsed} ${u.Unit}</td><td class="qty-display">${balanceLabel}</td></tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}