import { apiCall } from '../core/api.js';
import { DB, CONSTANTS, getLookup, generateId, loadRealData } from '../core/store.js';
import { escapeHtml, formatDate, showToast, openModal, closeModal, getUnitMultiplier } from '../core/utils.js';

// --- Global Math & Alert Utilities ---
window.getInventoryTotalQty = function(inventoryId) {
    return DB.batches.filter(b => b.InventoryID === inventoryId && b.Status === 'Active').reduce((sum, b) => sum + parseFloat(b.CurrentQuantity), 0);
};

window.getInventoryTotalReceived = function(inventoryId) {
    return DB.batches.filter(b => b.InventoryID === inventoryId && b.Status === 'Active').reduce((sum, b) => sum + parseFloat(b.QuantityReceived), 0);
};

window.getAlertStatus = function(inventoryId) {
    const inv = DB.inventory.find(i => i.id === inventoryId);
    if (!inv) return 'ok';
    const total = window.getInventoryTotalQty(inventoryId); const totalReceived = window.getInventoryTotalReceived(inventoryId);
    if (totalReceived === 0) return 'ok';
    if ((total / totalReceived) * 100 <= inv.AlertThreshold) return 'low';
    
    const batches = DB.batches.filter(b => b.InventoryID === inventoryId && b.Status === 'Active');
    const today = new Date();
    for (const b of batches) {
        const exp = new Date(b.ExpiryDate);
        const daysLeft = (exp - today) / (1000*60*60*24);
        if (daysLeft <= 30) return 'expiry';
    }
    return 'ok';
};

window.getAlertBadge = function(inventoryId) {
    const status = window.getAlertStatus(inventoryId);
    if (status === 'low') return '<span class="badge badge-danger">Low Stock</span>';
    if (status === 'expiry') return '<span class="badge badge-warning">Expiring</span>';
    return '<span class="badge badge-success">OK</span>';
};

window.getQtyClass = function(inventoryId) {
    const status = window.getAlertStatus(inventoryId);
    if (status === 'low') return 'low';
    if (status === 'expiry') return 'warning';
    return '';
};

// --- Inventory UI ---
export function renderInventory(content) {
    const search = (document.getElementById('searchInv')?.value || '').toLowerCase();
    const filterType = document.getElementById('filterInvType')?.value || '';
    let items = DB.inventory;
    if (search) items = items.filter(i => (i.MaterialName || '').toLowerCase().includes(search) || (i.Make || '').toLowerCase().includes(search) || (i.InventoryCode || '').toLowerCase().includes(search));
    if (filterType) items = items.filter(i => i.MaterialType === filterType);

    content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h1 class="page-title">Inventory Master</h1><p class="page-subtitle">Central material catalogue and current stock levels</p></div>
            <button class="btn btn-primary" onclick="openGlobalUsageModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Record Usage</button>
        </div>
        <div class="filters-bar">
            <div class="search-box" style="max-width:250px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchInv" placeholder="Search materials..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterInvType" onchange="renderCurrentPage()"><option value="">All Types</option>${CONSTANTS.MATERIAL_TYPES.map(t=>`<option value="${t}" ${filterType===t?'selected':''}>${t}</option>`).join('')}</select>
            ${DB.settings.currentRole === 'Admin' ? `<input type="file" id="bulkUploadFile" accept=".xlsx" style="display:none" onchange="handleBulkUpload(event)"><button class="btn btn-secondary" onclick="window.location.href='/api/inventory/template'">Download Template</button><button class="btn btn-secondary" onclick="document.getElementById('bulkUploadFile').click()">Upload Excel</button><button class="btn btn-primary" onclick="openInventoryModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Material</button>` : ''}
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Material</th><th>Type</th><th>Unit</th><th>Stock</th><th>Alert</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map((i, idx) => {
                    const total = window.getInventoryTotalQty(i.id);
                    return `<tr>
                        <td>${idx + 1}</td>
                        <td><div style="font-weight:600;">${escapeHtml(i.MaterialName)}</div><div style="font-size:11px;color:var(--gray-500);">${escapeHtml(i.Make)} ${i.Model?'| '+escapeHtml(i.Model):''}</div></td>
                        <td><span class="badge badge-gray">${i.MaterialType}</span></td>
                        <td>${i.Unit}</td>
                        <td class="qty-display ${window.getQtyClass(i.id)}">${total} ${i.Unit}</td>
                        <td>${window.getAlertBadge(i.id)}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-primary" style="padding:4px 8px;" onclick="showMaterialHistory('${i.id}')" title="Usage History"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> History</button>
                            ${DB.settings.currentRole === 'Admin' ? `<button class="btn btn-sm btn-secondary" onclick="openInventoryModal('${i.id}')">Edit</button>` : ''}
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

window.openInventoryModal = function(id) {
    const item = id ? getLookup(id, 'inventory') : null;
    const invCode = item ? item.InventoryCode : generateId('INV', 'inventory');
    openModal(item ? 'Edit Material' : 'Add Material', `
        <form id="inventoryForm" onsubmit="saveInventory(event)">
            <input type="hidden" name="InventoryCode" value="${invCode}">
            <div class="form-grid">
                <div class="form-group"><label>Inventory Code</label><input type="text" class="form-control" value="${invCode}" disabled></div>
                <div class="form-group"><label>Material Name <span class="required">*</span></label><input type="text" class="form-control" name="MaterialName" value="${item?escapeHtml(item.MaterialName):''}" required oninput="checkDuplicateMaterial()"><div id="duplicateWarning"></div></div>
                <div class="form-group"><label>Material Type <span class="required">*</span></label><select class="form-control" name="MaterialType" required>${CONSTANTS.MATERIAL_TYPES.map(t=>`<option value="${t}" ${item&&item.MaterialType===t?'selected':''}>${t}</option>`).join('')}</select></div>
                <div class="form-group"><label>Make</label><input type="text" class="form-control" name="Make" value="${item?escapeHtml(item.Make):''}"></div>
                <div class="form-group"><label>Model</label><input type="text" class="form-control" name="Model" value="${item?escapeHtml(item.Model):''}"></div>
                <div class="form-group"><label>Quantity Per Pack/Box/Bottle/Kit Size <span class="required">*</span></label><input type="number" class="form-control" name="PackQty" step="0.01" min="0.01" value="${item?item.PackQty:1}" required></div>
                <div class="form-group"><label>Unit <span class="required">*</span></label><select class="form-control" name="Unit" required>${CONSTANTS.UNITS.map(u=>`<option value="${u}" ${item&&item.Unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
                <div class="form-group"><label>Alert Threshold (%)</label><input type="number" class="form-control" name="AlertThreshold" min="1" max="100" value="${item?item.AlertThreshold:15}"></div>
                <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Inactive" ${item&&item.Status==='Inactive'?'selected':''}>Inactive</option></select></div>
            </div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('inventoryForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.checkDuplicateMaterial = function() {
    const input = document.querySelector('#inventoryForm [name="MaterialName"]').value.toLowerCase();
    const warningDiv = document.getElementById('duplicateWarning');
    if(input.length < 3) { warningDiv.innerHTML = ''; return; }
    const matches = DB.inventory.filter(i => i.MaterialName.toLowerCase().includes(input));
    if(matches.length > 0) {
        warningDiv.innerHTML = `<div style="margin-top:6px; padding:8px; background:var(--warning-light); color:var(--warning); border-radius:var(--radius-sm); font-size:12px;"><strong>Warning:</strong> Similar items exist: ${matches.map(m => escapeHtml(m.MaterialName)).join(', ')}. <br><a href="#" style="color:var(--primary); font-weight:600;" onclick="closeModal(); setTimeout(() => openBatchModal(), 200);">Add a batch to existing item instead?</a></div>`;
    } else { warningDiv.innerHTML = ''; }
};

window.saveInventory = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('inventoryForm')));
    const payload = { id: data.id ? parseInt(data.id) : null, item_code: data.InventoryCode, material_name: data.MaterialName, make: data.Make, model: data.Model, category: data.MaterialType, alert_threshold: parseFloat(data.AlertThreshold || 15), base_unit: data.Unit, pack_qty: parseFloat(data.PackQty || 1) };
    const res = await apiCall('/api/inventory', payload, 'POST');
    if (res.status === 'success') { await loadRealData(); showToast('Material saved successfully!', 'success'); closeModal(); window.renderCurrentPage(); } else showToast('Error saving material', 'error');
};

window.handleBulkUpload = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    showToast('Parsing file & running similarity checks...', 'info');
    try {
        const res = await fetch('/api/inventory/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (result.status === 'success') window.openBulkReviewModal(result.data); else showToast(result.message, 'error');
    } catch (err) { showToast('Connection error.', 'error'); }
    e.target.value = '';
};

window.openBulkReviewModal = function(rows) {
    window._bulkStagingData = rows; 
    openModal('Review Inventory Upload', `
        <p style="font-size:13px; color:var(--gray-500); margin-bottom:16px;">Items with > 80% match score are likely duplicates. Tick <strong>Merge</strong> to skip creating a master item so you can add it as a batch later.</p>
        <div class="table-container" style="max-height:400px; overflow-y:auto; border:1px solid var(--line); border-radius:var(--radius-md);">
            <table class="data-table"><thead style="position:sticky; top:0; z-index:1;"><tr><th>Material (Upload)</th><th>Size & Unit</th><th>Match Score</th><th>Merge?</th></tr></thead>
            <tbody>${rows.map((r, idx) => {
                const isDup = r.MatchScore > 80;
                const matchUI = isDup ? `<div style="color:var(--danger); font-weight:600;">${r.MatchScore}% Match</div><div style="font-size:11px; color:var(--gray-500);">Found: ${escapeHtml(r.MatchedName)}</div>` : `<div style="color:var(--success); font-weight:600;">${r.MatchScore}% (New)</div>`;
                const mergeUI = isDup ? `<label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="mergeCheck_${idx}" checked> <span style="font-size:12px;">Merge (Skip)</span></label>` : `<span style="font-size:12px; color:var(--gray-400);">N/A</span>`;
                return `<tr style="${isDup ? 'background:var(--danger-light);' : ''}"><td><strong>${escapeHtml(r.MaterialName)}</strong><br><span style="font-size:11px; color:var(--gray-500);">${escapeHtml(r.MaterialType)} | ${escapeHtml(r.Make)}</span></td><td>${r.PackQty} ${escapeHtml(r.Unit)}</td><td>${matchUI}</td><td>${mergeUI}</td></tr>`;
            }).join('')}</tbody></table>
        </div>
    `, 'modal-xl', `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="commitBulkUpload()">Confirm & Save to Inventory</button>`);
};

window.commitBulkUpload = async function() {
    const rows = window._bulkStagingData;
    rows.forEach((r, idx) => { const cb = document.getElementById(`mergeCheck_${idx}`); r.MergeWithID = cb && cb.checked; });
    const res = await apiCall('/api/inventory/bulk', { rows: rows }, 'POST');
    if (res.status === 'success') { await loadRealData(); showToast(res.message, 'success'); closeModal(); window.renderCurrentPage(); } else showToast(res.message, 'error');
};

// --- Batches UI ---
export function renderBatches(content) {
    const search = (document.getElementById('searchBatch')?.value || '').toLowerCase();
    const filterInv = document.getElementById('filterBatchInv')?.value || '';
    const filterDept = document.getElementById('filterBatchDept')?.value || '';
    const fromDate = document.getElementById('batchFrom')?.value || '';
    const toDate = document.getElementById('batchTo')?.value || '';
    
    let items = DB.batches;
    if (search) items = items.filter(b => (b.BatchCode || '').toLowerCase().includes(search) || (b.LotNumber || '').toLowerCase().includes(search) || (b.PurchaseOrderNo || '').toLowerCase().includes(search));
    if (filterInv) items = items.filter(b => b.InventoryID === filterInv);
    if (filterDept && DB.settings.system_mode !== 'Single') items = items.filter(b => b.DepartmentID === filterDept);
    if (fromDate) items = items.filter(b => b.ExpiryDate >= fromDate);
    if (toDate) items = items.filter(b => b.ExpiryDate <= toDate);

    content.innerHTML = `
        <h1 class="page-title">Batch Management</h1><p class="page-subtitle">Track procurement batches, assigned departments, and quantities</p>
        <div class="filters-bar">
            <div class="search-box" style="max-width:220px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="searchBatch" placeholder="Search batches..." value="${escapeHtml(search)}" oninput="renderCurrentPage()"></div>
            <select class="form-control" id="filterBatchInv" onchange="renderCurrentPage()"><option value="">All Materials</option>${DB.inventory.filter(i=>i.Status==='Active').map(i=>`<option value="${i.id}" ${filterInv===i.id?'selected':''}>${escapeHtml(i.MaterialName)}</option>`).join('')}</select>
            ${DB.settings.system_mode !== 'Single' ? `<select class="form-control" id="filterBatchDept" onchange="renderCurrentPage()"><option value="">All Departments</option>${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${filterDept===d.id?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}</select>` : ''}
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">FROM</span><input type="date" class="form-control" id="batchFrom" value="${fromDate}" onchange="renderCurrentPage()"></div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;color:var(--gray-500);font-weight:600;">TO</span><input type="date" class="form-control" id="batchTo" value="${toDate}" onchange="renderCurrentPage()"></div>
            <button class="btn btn-primary" onclick="openBatchModal()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Add Batch</button>
        </div>
        <div class="card"><div class="table-container"><table class="data-table">
            <thead><tr><th>SN</th><th>Material</th>${DB.settings.system_mode !== 'Single'?'<th>Department</th>':''}<th>Study</th><th>PO No</th><th>Lot</th><th>Expiry</th><th>Received</th><th>Current</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map((b, idx) => {
                    const inv = getLookup(b.InventoryID, 'inventory'); const dept = getLookup(b.DepartmentID, 'departments'); const study = getLookup(b.StudyID, 'studies');
                    const expClass = Math.ceil((new Date(b.ExpiryDate) - new Date()) / (1000*60*60*24)) <= 30 ? 'low' : Math.ceil((new Date(b.ExpiryDate) - new Date()) / (1000*60*60*24)) <= 90 ? 'warning' : '';
                    return `<tr><td>${idx + 1}</td><td>${inv?escapeHtml(inv.MaterialName):'N/A'}</td>${DB.settings.system_mode !== 'Single'?`<td>${dept?escapeHtml(dept.DepartmentName):'<span class="text-muted">Unassigned</span>'}</td>`:''}<td>${study?escapeHtml(study.StudyName):'-'}</td><td>${escapeHtml(b.PurchaseOrderNo)}</td><td>${escapeHtml(b.LotNumber)}</td><td class="qty-display ${expClass}">${formatDate(b.ExpiryDate)}</td><td>${b.QuantityReceived} ${b.Unit}</td><td class="qty-display ${parseFloat(b.CurrentQuantity) <= b.QuantityReceived * 0.15 ? 'low' : ''}">${b.CurrentQuantity} ${b.Unit}</td><td><span class="badge ${b.Status==='Active'?'badge-success':b.Status==='Depleted'?'badge-gray':'badge-warning'}">${b.Status}</span></td><td class="table-actions"><button class="btn btn-sm btn-secondary" onclick="openBatchModal('${b.id}')">Edit</button></td></tr>`;
                }).join('')}
            </tbody>
        </table></div></div>
    `;
}

window.openBatchModal = function(id) {
    const item = id ? getLookup(id, 'batches') : null;
    const inv = item ? DB.inventory.find(i => i.id === item.InventoryID) : null;
    const initialPacks = (item && inv && inv.PackQty) ? (item.QuantityReceived / inv.PackQty) : '';
    const initialDisplay = item ? `Total: <strong>${item.QuantityReceived} ${item.Unit}</strong>` : `Total: <strong>0</strong>`;
    const singleDeptId = DB.departments.find(d => d.Status === 'Active')?.id || '';
    const targetDept = item ? item.DepartmentID : (DB.settings.system_mode === 'Single' ? singleDeptId : '');

    openModal(item ? 'Edit Batch' : 'Add Batch', `
        <form id="batchForm" onsubmit="saveBatch(event)">
            <div class="form-grid">
                <div class="form-group"><label>Batch Code</label><input type="text" class="form-control" value="${item?item.BatchCode:generateId('BAT','batches')}" disabled></div>
                
                <div class="form-group">
                    <label>Material <span class="required">*</span></label>
                    <div class="autocomplete-wrapper">
                        <input type="text" class="form-control" id="batchInventorySearch" placeholder="Type to search material..." oninput="filterBatchMaterials(this.value)" autocomplete="off" value="${inv ? escapeHtml(inv.MaterialName) : ''}" required ${item ? 'disabled title="Cannot change material on existing batch"' : ''}>
                        <input type="hidden" name="InventoryID" id="batchInventory" value="${item ? item.InventoryID : ''}">
                        <div class="autocomplete-results" id="batchInventoryResults"></div>
                    </div>
                </div>

                <div class="form-group" style="${DB.settings.system_mode === 'Single' ? 'display:none;' : ''}"><label>Assigned Department <span class="required">*</span></label><select class="form-control" name="DepartmentID" required>${DB.settings.system_mode === 'Single' ? `<option value="${singleDeptId}" selected>Main Lab</option>` : `<option value="">Select Department</option>${DB.departments.filter(d=>d.Status==='Active').map(d=>`<option value="${d.id}" ${String(targetDept)===String(d.id)?'selected':''}>${escapeHtml(d.DepartmentName)}</option>`).join('')}`}</select></div>
                <div class="form-group"><label>Associated Study <span class="required">*</span></label><select class="form-control" name="StudyID" required><option value="">Select Study</option>${DB.studies.filter(s=>s.Status==='Active').map(s=>`<option value="${s.id}" ${item&&String(item.StudyID)===String(s.id)?'selected':''}>${escapeHtml(s.StudyName)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Vendor</label><select class="form-control" name="VendorID"><option value="">Select Vendor</option>${DB.vendors.map(v=>`<option value="${v.id}" ${item&&String(item.VendorID)===String(v.id)?'selected':''}>${escapeHtml(v.VendorName)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Purchase Order No <span class="required">*</span></label><input type="text" class="form-control" name="PurchaseOrderNo" value="${item?escapeHtml(item.PurchaseOrderNo):''}" required></div>
                <div class="form-group"><label>Lot Number <span class="required">*</span></label><input type="text" class="form-control" name="LotNumber" value="${item?escapeHtml(item.LotNumber):''}" required></div>
                <div class="form-group"><label>Expiry Date <span class="required">*</span></label><input type="date" class="form-control" name="ExpiryDate" value="${item?item.ExpiryDate:new Date().toISOString().split('T')[0]}" required></div>
                
                <div class="form-group" style="background:var(--gray-50); padding:12px; border-radius:var(--radius-md); border:1px solid var(--line);">
                    <label>Number of Packs/Box/Bottle/Kit Received <span class="required">*</span></label>
                    <input type="number" class="form-control" name="NumPacks" step="0.01" min="0.01" required oninput="updateBatchCalculation()" value="${initialPacks}">
                    <div id="batchCalcDisplay" style="margin-top:8px; font-size:13px; color:var(--primary); text-align:right;">${initialDisplay}</div>
                    <input type="hidden" name="QuantityReceived" id="batchQuantityReceived" value="${item?item.QuantityReceived:''}">
                    <input type="hidden" name="Unit" id="batchUnitHidden" value="${item?item.Unit:''}">
                </div>
                
                <div class="form-group"><label>Status</label><select class="form-control" name="Status"><option value="Active" ${item&&item.Status==='Active'?'selected':''}>Active</option><option value="Depleted" ${item&&item.Status==='Depleted'?'selected':''}>Depleted</option><option value="Expired" ${item&&item.Status==='Expired'?'selected':''}>Expired</option></select></div>
                <div class="form-group full-width"><label>Remarks</label><textarea class="form-control" name="Remarks" rows="2">${item?escapeHtml(item.Remarks):''}</textarea></div>
            </div>
            ${item?`<input type="hidden" name="id" value="${item.id}">`:''}
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('batchForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save</button>`);
};

window.updateBatchCalculation = function() {
    const invId = document.querySelector('#batchForm [name="InventoryID"]').value;
    const packsReceived = parseFloat(document.querySelector('#batchForm [name="NumPacks"]').value) || 0;
    const inv = DB.inventory.find(i => i.id === invId);
    const displayObj = document.getElementById('batchCalcDisplay'), qtyInput = document.getElementById('batchQuantityReceived'), unitHidden = document.getElementById('batchUnitHidden');
    
    if (inv && packsReceived > 0) { const total = packsReceived * inv.PackQty; displayObj.innerHTML = `Total: <strong>${total} ${inv.Unit}</strong>`; qtyInput.value = total; if (unitHidden) unitHidden.value = inv.Unit; } 
    else { displayObj.innerHTML = 'Total: <strong>0</strong>'; qtyInput.value = ''; if (unitHidden) unitHidden.value = ''; }
};

window.saveBatch = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('batchForm')));
    
    // Validate autocomplete input
    if (!data.InventoryID) { showToast('Please select a valid material from the search list.', 'error'); return; }

    const item = data.id ? getLookup(data.id, 'batches') : null;
    let receivedQty = parseFloat(data.QuantityReceived);
    let currentQty = receivedQty;

    if (item) {
        const oldReceived = parseFloat(item.QuantityReceived);
        currentQty = parseFloat(item.CurrentQuantity) + (receivedQty - oldReceived);
        if (currentQty < 0) { showToast('Error: Cannot reduce received packs below amount consumed.', 'error'); return; }
    }

    const payload = { id: data.id ? parseInt(data.id) : null, inventory_id: data.InventoryID, department_id: data.DepartmentID || null, study_id: data.StudyID || null, vendor_id: data.VendorID ? parseInt(data.VendorID) : null, po_number: data.PurchaseOrderNo, lot_number: data.LotNumber, expiry_date: data.ExpiryDate, quantity_received: receivedQty, current_quantity: currentQty, unit: data.Unit, status: data.Status || 'Active', remarks: data.Remarks || '' };
    const res = await apiCall('/api/batches', payload, 'POST');
    if (res.status === 'success') { await loadRealData(); showToast('Saved!', 'success'); closeModal(); window.renderCurrentPage(); } else showToast('Error saving batch', 'error');
};

// --- Smart Record Usage Modal Engine ---
window._activeEquipments = [];

window.openGlobalUsageModal = function() {
    window._activeEquipments = []; 
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0,5);
    const activeStudies = DB.studies.filter(s => s.Status === 'Active');
    const activeUsers = DB.users.filter(u => u.Status === 'Active');

    openModal('Record Material Usage', `
        <form id="globalUsageForm" onsubmit="saveGlobalUsage(event)">
            <div class="form-grid">
                <div class="form-group">
                    <label>Used By <span class="required">*</span></label>
                    <select class="form-control" name="UserID" id="usageUser" required onchange="filterStudiesByUser()">
                        <option value="">Select User</option>
                        ${activeUsers.map(u => `<option value="${u.id}" ${u.UserName === DB.settings.currentUser ? 'selected' : ''}>${escapeHtml(u.UserName)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Study / Activity <span class="required">*</span></label>
                    <select class="form-control" name="StudyID" id="usageStudy" required>
                        <option value="">Select Study</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Material Search <span class="required">*</span></label>
                    <div class="autocomplete-wrapper">
                        <input type="text" class="form-control" id="usageInventorySearch" placeholder="Type to search..." oninput="filterUsageMaterials(this.value)" autocomplete="off" required>
                        <input type="hidden" name="InventoryID" id="usageInventory">
                        <div class="autocomplete-results" id="usageInventoryResults"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Batch <span class="required">*</span></label>
                    <select class="form-control" name="BatchID" id="usageBatch" required>
                        <option value="">Select Batch (Search material first)</option>
                    </select>
                </div>
                
                <div class="form-group"><label>Date <span class="required">*</span></label><input type="date" class="form-control" name="UsageDate" value="${today}" required></div>
                <div class="form-group"><label>Time <span class="required">*</span></label><input type="time" class="form-control" name="UsageTime" value="${now}" required></div>
                <div class="form-group"><label>Quantity Used <span class="required">*</span></label><input type="number" class="form-control" name="QuantityUsed" step="0.01" min="0.01" required></div>
                <div class="form-group">
                    <label>Unit <span class="required">*</span></label>
                    <select class="form-control" name="Unit" id="usageUnit" required><option value="">Select Unit</option>${CONSTANTS.UNITS.map(u => `<option value="${u}">${u}</option>`).join('')}</select>
                </div>
                
                <div class="form-group full-width" style="background:var(--gray-50); padding:12px; border-radius:var(--radius-md); border:1px solid var(--line);">
                    <label>Equipment Used (Multiple Selection Allowed)</label>
                    <div class="autocomplete-wrapper" onclick="document.getElementById('equipSearchInput').focus()">
                        <div class="multi-select-box" id="equipChipsContainer">
                            <input type="text" class="multi-select-input" id="equipSearchInput" placeholder="Type to search instruments..." oninput="filterEquipSearch(this.value)" onfocus="filterEquipSearch(this.value)" autocomplete="off">
                        </div>
                        <div class="autocomplete-results" id="equipSearchResults"></div>
                    </div>
                    <p style="font-size:11px;color:var(--gray-500);margin-top:6px;">*Quarantined equipment is locked and cannot be selected.</p>
                </div>

                <div class="form-group full-width"><label>Remarks</label><textarea class="form-control" name="Remarks" rows="2" placeholder="Purpose of usage..."></textarea></div>
            </div>
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="button" class="btn btn-primary" onclick="document.getElementById('globalUsageForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save Usage</button>`);
    setTimeout(() => window.filterStudiesByUser(), 100);
};

// --- Smart Boolean Search Engine ---
window.filterUsageMaterials = function(query) {
    const resultsDiv = document.getElementById('usageInventoryResults');
    const hiddenInput = document.getElementById('usageInventory');
    const batchSelect = document.getElementById('usageBatch');
    const unitSelect = document.getElementById('usageUnit');

    hiddenInput.value = '';
    batchSelect.innerHTML = '<option value="">Select Batch (Search material first)</option>';
    unitSelect.innerHTML = '<option value="">Select Unit</option>';

    if (!query.trim()) { resultsDiv.style.display = 'none'; return; }

    const terms = query.toLowerCase().trim().split(/\s+/);
    const activeInv = DB.inventory.filter(i => i.Status === 'Active');

    const matches = activeInv.filter(i => {
        const searchString = `${i.MaterialName} ${i.Make||''} ${i.Model||''} ${i.InventoryCode}`.toLowerCase();
        return terms.every(term => searchString.includes(term));
    });

    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(i => `
            <div class="autocomplete-item" onclick="selectUsageMaterial('${i.id}', '${escapeHtml(i.MaterialName).replace(/'/g, "\\'")}')">
                <strong>${escapeHtml(i.MaterialName)}</strong> 
                <span class="item-code">${escapeHtml(i.InventoryCode)} | Make: ${escapeHtml(i.Make || 'N/A')}</span>
            </div>`).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<div style="padding:10px 12px; font-size:12px; color:var(--gray-500);">No materials match your search.</div>';
        resultsDiv.style.display = 'block';
    }
};

// --- Batch Autocomplete Search Engine ---
window.filterBatchMaterials = function(query) {
    const resultsDiv = document.getElementById('batchInventoryResults');
    const hiddenInput = document.getElementById('batchInventory');
    
    // Clear selection on new typing
    hiddenInput.value = '';
    document.getElementById('batchCalcDisplay').innerHTML = 'Total: <strong>0</strong>';
    document.getElementById('batchQuantityReceived').value = '';

    if (!query.trim()) { resultsDiv.style.display = 'none'; return; }

    const terms = query.toLowerCase().trim().split(/\s+/);
    const activeInv = DB.inventory.filter(i => i.Status === 'Active');

    const matches = activeInv.filter(i => {
        const searchString = `${i.MaterialName} ${i.Make||''} ${i.Model||''} ${i.InventoryCode}`.toLowerCase();
        return terms.every(term => searchString.includes(term));
    });

    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(i => `
            <div class="autocomplete-item" onclick="selectBatchMaterial('${i.id}', '${escapeHtml(i.MaterialName).replace(/'/g, "\\'")}')">
                <strong>${escapeHtml(i.MaterialName)}</strong> 
                <span class="item-code">${escapeHtml(i.InventoryCode)} | Make: ${escapeHtml(i.Make || 'N/A')}</span>
            </div>`).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<div style="padding:10px 12px; font-size:12px; color:var(--gray-500);">No materials match your search.</div>';
        resultsDiv.style.display = 'block';
    }
};

window.selectBatchMaterial = function(id, name) {
    document.getElementById('batchInventorySearch').value = name;
    document.getElementById('batchInventory').value = id;
    document.getElementById('batchInventoryResults').style.display = 'none';
    window.updateBatchCalculation();
};

window.selectUsageMaterial = function(id, name) {
    document.getElementById('usageInventorySearch').value = name;
    document.getElementById('usageInventory').value = id;
    document.getElementById('usageInventoryResults').style.display = 'none';
    window.updateGlobalUsageBatches();
};

// --- Multi-Select Equipment Logic ---
window.renderEquipChips = function() {
    const container = document.getElementById('equipChipsContainer');
    const input = document.getElementById('equipSearchInput');
    container.querySelectorAll('.chip').forEach(c => c.remove()); 
    
    window._activeEquipments.forEach((eq, index) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span>${escapeHtml(eq.name)} (${escapeHtml(eq.code)})</span> <span class="chip-close" onclick="removeEquip(${index}, event)"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></span>`;
        container.insertBefore(chip, input);
    });
};

window.removeEquip = function(index, e) {
    e.stopPropagation();
    window._activeEquipments.splice(index, 1);
    window.renderEquipChips();
};

window.filterEquipSearch = function(query) {
    const resultsDiv = document.getElementById('equipSearchResults');
    const term = query.toLowerCase().trim();
    const selectedIds = window._activeEquipments.map(e => String(e.id));
    
    const available = DB.equipment.filter(e => e.status !== 'Quarantined' && e.status !== 'Decommissioned' && !selectedIds.includes(String(e.id)));
    const matches = term ? available.filter(e => e.name.toLowerCase().includes(term) || e.equip_code.toLowerCase().includes(term)) : available;

    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(e => `<div class="autocomplete-item" onclick="selectEquip('${e.id}', '${escapeHtml(e.name).replace(/'/g, "\\'")}', '${escapeHtml(e.equip_code).replace(/'/g, "\\'")}')"><strong>${escapeHtml(e.name)}</strong> <span class="item-code">${escapeHtml(e.equip_code)}</span></div>`).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<div style="padding:10px 12px; font-size:12px; color:var(--gray-500);">No instruments found.</div>';
        resultsDiv.style.display = 'block';
    }
};

window.selectEquip = function(id, name, code) {
    window._activeEquipments.push({id, name, code});
    document.getElementById('equipSearchInput').value = '';
    document.getElementById('equipSearchResults').style.display = 'none';
    window.renderEquipChips();
};

// Global click listener to close both autocomplete dropdowns
document.addEventListener('click', function(e) {
    const invResults = document.getElementById('usageInventoryResults');
    if (invResults && e.target.id !== 'usageInventorySearch') invResults.style.display = 'none';
    
    const eqResults = document.getElementById('equipSearchResults');
    if (eqResults && e.target.id !== 'equipSearchInput') eqResults.style.display = 'none';
    
    const batchResults = document.getElementById('batchInventoryResults');
    if (batchResults && e.target.id !== 'batchInventorySearch') batchResults.style.display = 'none';
});

window.filterStudiesByUser = function() {
    const userId = document.getElementById('usageUser').value;
    const studySelect = document.getElementById('usageStudy');
    let validStudies = DB.studies.filter(s => s.Status === 'Active');
    
    if (userId) {
        const assignedStudyIds = DB.userStudyAssignments.filter(a => String(a.user_id) === String(userId)).map(a => String(a.study_id));
        validStudies = validStudies.filter(s => assignedStudyIds.includes(String(s.id)));
    }
    
    studySelect.innerHTML = '<option value="">Select Study</option>' + validStudies.map(s => `<option value="${s.id}">${escapeHtml(s.StudyName)} (${s.StudyCode})</option>`).join('');
};

window.updateGlobalUsageBatches = function() {
    const invId = document.getElementById('usageInventory').value;
    const batchSelect = document.getElementById('usageBatch');
    const unitSelect = document.getElementById('usageUnit');
    if (!invId) return;
    
    const batches = DB.batches.filter(b => b.InventoryID === invId && b.Status === 'Active' && parseFloat(b.CurrentQuantity) > 0);
    batchSelect.innerHTML = '<option value="">Select Batch</option>' + batches.map(b => `<option value="${b.id}">${b.BatchCode} - ${b.CurrentQuantity} ${b.Unit} left (Exp: ${formatDate(b.ExpiryDate)})</option>`).join('');
    
    const inv = getLookup(invId, 'inventory');
    if (inv) { 
        const famMap = { mass: ['kg', 'g', 'mg', 'ug'], volume: ['L', 'mL', 'uL'] };
        let allowed = [inv.Unit];
        if (famMap.mass.includes(inv.Unit)) allowed = famMap.mass;
        if (famMap.volume.includes(inv.Unit)) allowed = famMap.volume;
        unitSelect.innerHTML = allowed.map(u => `<option value="${u}" ${u===inv.Unit?'selected':''}>${u}</option>`).join('');
    }
};

window.saveGlobalUsage = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('globalUsageForm')));
    
    if (!data.InventoryID) { showToast('Please select a valid material from the search list.', 'error'); return; }

    const study = getLookup(data.StudyID, 'studies');
    const batch = getLookup(data.BatchID, 'batches');
    const qtyRaw = parseFloat(data.QuantityUsed);

    if (!batch) { showToast('Invalid Batch selected', 'error'); return; }
    if (!study) { showToast('Invalid Study selected', 'error'); return; }

    const usedMult = getUnitMultiplier(data.Unit);
    const batchMult = getUnitMultiplier(batch.Unit);
    const normQty = (qtyRaw * usedMult) / batchMult;

    if (parseFloat(batch.CurrentQuantity) < normQty) { 
        showToast(`Insufficient quantity. Tried to use ${qtyRaw} ${data.Unit} (which is ${normQty} ${batch.Unit}), but only ${batch.CurrentQuantity} ${batch.Unit} remains.`, 'error'); 
        return; 
    }
    
    const equipIds = window._activeEquipments.map(e => e.id).join(',');
    
    const payload = {
        inventory_id: parseInt(data.InventoryID), batch_id: parseInt(data.BatchID), batch_code: batch.BatchCode,
        quantity_used: qtyRaw, unit: data.Unit, user_id: data.UserID, study_id: data.StudyID, faculty_id: study.FacultyID,         
        department_id: study.DepartmentID, equip_id: equipIds || null, remarks: data.Remarks || ''
    };

    const res = await apiCall('/api/usage', payload, 'POST');
    if (res.status === 'success') { 
        const user = getLookup(data.UserID, 'users');
        await window.logHistory('Usage', batch.BatchCode, 'Material Consumed', '', `${qtyRaw} ${data.Unit} used by ${user ? user.UserName : 'User'}`);
        await loadRealData(); 
        showToast('Usage recorded & stock deducted!', 'success'); 
        closeModal(); 
        window.renderCurrentPage(); 
    } else { showToast(res.message || 'Error recording usage', 'error'); }
};

// --- Material History & Dossier Engine ---
window.showMaterialHistory = function(inventoryId) {
    const item = getLookup(inventoryId, 'inventory');
    if (!item) return;

    const materialBatches = DB.batches.filter(b => b.InventoryID === inventoryId).sort((a,b) => new Date(b.ExpiryDate) - new Date(a.ExpiryDate));
    const materialUsage = DB.usage.filter(u => u.InventoryID === inventoryId).sort((a,b) => new Date(b.UsageDate) - new Date(a.UsageDate));
    const totalQty = window.getInventoryTotalQty(inventoryId);

    openModal(`Material Dossier: ${escapeHtml(item.MaterialName)}`, `
        <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                    <span class="code-display" style="font-size:14px; padding:4px 10px;">${escapeHtml(item.InventoryCode)}</span>
                    <span style="margin-left:8px;font-size:13px;color:var(--gray-500);">${escapeHtml(item.Make)} ${item.Model ? '| ' + escapeHtml(item.Model) : ''}</span>
                </div>
                <div style="font-size:16px;">Global Stock: <strong class="qty-display ${window.getQtyClass(inventoryId)}">${totalQty} ${item.Unit}</strong></div>
            </div>

            <h4 style="margin-top:24px; margin-bottom:12px; font-size:15px;">Active & Historical Batches</h4>
            <div class="table-container" style="max-height:200px; overflow-y:auto; border: 1px solid var(--line); border-radius: var(--radius-md);">
                <table class="data-table">
                    <thead style="position:sticky; top:0; z-index:1;"><tr><th>Batch Code</th><th>Lot Number</th><th>Expiry Date</th><th>Received</th><th>Current</th><th>Status</th></tr></thead>
                    <tbody>
                        ${materialBatches.map(b => {
                            const expClass = Math.ceil((new Date(b.ExpiryDate) - new Date()) / (1000*60*60*24)) <= 30 ? 'low' : '';
                            return `<tr>
                                <td><span class="code-display">${escapeHtml(b.BatchCode)}</span></td>
                                <td>${escapeHtml(b.LotNumber)}</td>
                                <td class="qty-display ${expClass}">${formatDate(b.ExpiryDate)}</td>
                                <td>${b.QuantityReceived} ${b.Unit}</td>
                                <td><strong>${b.CurrentQuantity} ${b.Unit}</strong></td>
                                <td><span class="badge ${b.Status==='Active'?'badge-success':b.Status==='Depleted'?'badge-gray':'badge-warning'}">${b.Status}</span></td>
                            </tr>`;
                        }).join('')}
                        ${materialBatches.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--gray-500);padding:16px;">No batches recorded.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>

            <h4 style="margin-top:24px; margin-bottom:12px; font-size:15px;">Consumption Log</h4>
            <div class="table-container" style="max-height:250px; overflow-y:auto; border: 1px solid var(--line); border-radius: var(--radius-md);">
                <table class="data-table">
                    <thead style="position:sticky; top:0; z-index:1;"><tr><th>Date</th><th>Batch</th><th>Used By</th><th>Recorded By</th><th>Study</th><th>Qty Used</th><th>Balance</th></tr></thead>
                    <tbody>
                        ${materialUsage.map(u => {
                            const user = getLookup(u.UserID, 'users');
                            const study = getLookup(u.StudyID, 'studies');
                            const batch = getLookup(u.BatchID, 'batches');
                            const balanceLabel = (u.Balance !== null && u.Balance !== undefined) ? (u.Balance + ' ' + (batch ? batch.Unit : u.Unit)) : 'N/A';
                            return `<tr>
                                <td>${formatDate(u.UsageDate)}</td>
                                <td><span class="code-display">${escapeHtml(u.BatchCode)}</span></td>
                                <td>${user ? escapeHtml(user.UserName) : 'N/A'}</td>
                                <td><span class="badge badge-gray">${escapeHtml(u.RecordedBy)}</span></td>
                                <td>${study ? escapeHtml(study.StudyName) : 'N/A'}</td>
                                <td><strong style="color:var(--primary);">${u.QuantityUsed} ${escapeHtml(u.Unit)}</strong></td>
                                <td class="qty-display">${balanceLabel}</td>
                            </tr>`;
                        }).join('')}
                        ${materialUsage.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--gray-500);padding:16px;">No usage recorded yet.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `, 'modal-xl');
};