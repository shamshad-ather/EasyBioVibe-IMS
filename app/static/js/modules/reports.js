import { DB, CONSTANTS, getLookup } from '../core/store.js';
import { escapeHtml, formatDate } from '../core/utils.js';

export function renderReports(content) {
    content.innerHTML = `
        <h1 class="page-title">Reports</h1><p class="page-subtitle">Generate and view laboratory reports</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">
            <div class="report-card" onclick="renderReport('currentStock')"><div class="icon" style="background:var(--primary-light);color:var(--primary);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div><h3>Current Stock</h3><p>View all materials with current quantities and batch details</p></div>
            <div class="report-card" onclick="renderReport('lowStock')"><div class="icon" style="background:var(--danger-light);color:var(--danger);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div><h3>Low Stock Alert</h3><p>Materials below alert threshold requiring reorder</p></div>
            <div class="report-card" onclick="renderReport('expiry')"><div class="icon" style="background:var(--warning-light);color:var(--warning);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><h3>Expiry Alert</h3><p>Batches nearing expiration or already expired</p></div>
            <div class="report-card" onclick="renderReport('equipMaintenance')"><div class="icon" style="background:var(--warning-light);color:var(--warning);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg></div><h3>Maintenance Alerts</h3><p>Assets requiring calibration or service within 30 days based on active documents</p></div>
            <div class="report-card" onclick="renderReport('studyConsumption')"><div class="icon" style="background:var(--success-light);color:var(--success);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><h3>Study-wise Consumption</h3><p>Material usage breakdown by study/activity</p></div>
            <div class="report-card" onclick="renderReport('facultyConsumption')"><div class="icon" style="background:var(--primary-light);color:var(--primary);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div><h3>Faculty-wise Consumption</h3><p>Material usage breakdown by faculty member</p></div>
            <div class="report-card" onclick="renderReport('deptConsumption')"><div class="icon" style="background:var(--gray-100);color:var(--gray-600);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div><h3>Department-wise Consumption</h3><p>Material usage breakdown by department</p></div>
            <div class="report-card" onclick="renderReport('usageRecord')"><div class="icon" style="background:var(--primary-light);color:var(--primary-dark);"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg></div><h3>Usage Records</h3><p>Printable ledger of all laboratory material consumption</p></div>
        </div>
        <div id="reportContent" style="margin-top:24px;"></div>
    `;
    if (window.drillContext.reportId) { setTimeout(() => { window.renderReport(window.drillContext.reportId); window.drillContext.reportId = null; }, 50); }
}

window.renderReport = function (type) {
    const container = document.getElementById('reportContent');
    if (!container) return;
    const reportControls = `<style media="print">.report-controls { display: none !important; }</style><div class="report-controls" style="display:flex; justify-content:space-between; margin-bottom:16px;"><div class="search-box" style="width:300px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" class="form-control" id="reportSearch" placeholder="Search / Filter this report..." oninput="filterReportTable()"></div><button class="btn btn-secondary" onclick="window.print()"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg> Print View</button></div>`;

    switch (type) {
        case 'equipMaintenance':
            const today = new Date();
            const dueEquip = DB.equipment.filter(e => e.status !== 'Decommissioned').map(e => {
                const docs = DB.documents.filter(d => d.LinkedEquipID === e.id && CONSTANTS.COMPLIANCE_DOCS.includes(d.DocumentType) && d.ValidTo).sort((a, b) => new Date(a.ValidTo) - new Date(b.ValidTo));
                if (docs.length === 0) return null;
                const daysLeft = Math.ceil((new Date(docs[0].ValidTo) - today) / (1000 * 60 * 60 * 24));
                return daysLeft <= 30 ? { ...e, daysLeft, nextDue: docs[0].ValidTo, docType: docs[0].DocumentType } : null;
            }).filter(Boolean).sort((a, b) => a.daysLeft - b.daysLeft);

            container.innerHTML = `<div class="card"><div class="card-header"><h2>Equipment Maintenance Due</h2></div><div class="card-body">${reportControls}${dueEquip.length === 0 ? '<div class="alert alert-success">All active equipment schedules are up to date.</div>' : `<table class="data-table"><thead><tr><th>Asset Code</th><th>Asset Name</th><th>Location</th><th>Expiring Document</th><th>Expiry Date</th><th>Days Left</th></tr></thead><tbody>${dueEquip.map(e => `<tr><td><span class="code-display">${e.equip_code}</span></td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.location_room)}</td><td><span class="badge badge-info">${e.docType}</span></td><td class="qty-display ${e.daysLeft < 0 ? 'low' : 'warning'}">${formatDate(e.nextDue)}</td><td class="qty-display ${e.daysLeft < 0 ? 'low' : 'warning'}">${e.daysLeft < 0 ? 'Overdue (' + Math.abs(e.daysLeft) + 'd)' : e.daysLeft + ' days'}</td></tr>`).join('')}</tbody></table>`}</div></div>`;
            break;
        case 'usageRecord':
            const usageItems = [...DB.usage].sort((a, b) => new Date(b.UsageDate) - new Date(a.UsageDate));
            container.innerHTML = `
                <div class="card">
                    <div class="card-header"><h2>Usage Records Report</h2></div>
                    <div class="card-body">
                        ${reportControls}
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Material</th><th>Batch</th><th>Used By</th><th>Recorded By</th><th>Study</th><th>Equipment Used</th><th>Qty Used</th><th>Balance</th></tr>
                            </thead>
                            <tbody>
                                ${usageItems.map(u => {
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
                return `<tr>
                                        <td>${formatDate(u.UsageDate)}</td>
                                        <td>${inv ? escapeHtml(inv.MaterialName) : 'N/A'}</td>
                                        <td><span class="code-display">${escapeHtml(u.BatchCode)}</span></td>
                                        <td>${user ? escapeHtml(user.UserName) : 'N/A'}</td>
                                        <td><span class="badge badge-gray">${escapeHtml(u.RecordedBy || 'System')}</span></td>
                                        <td>${study ? escapeHtml(study.StudyName) : 'N/A'}</td>
                                        <td>${eqNames}</td>
                                        <td class="qty-display">${u.QuantityUsed} ${u.Unit}</td>
                                        <td class="qty-display">${balanceLabel}</td>
                                    </tr>`;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            break;
        case 'currentStock':
            const stockItems = DB.inventory.filter(i => i.Status === 'Active');
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Current Stock Report</h2></div><div class="card-body">${reportControls}<table class="data-table"><thead><tr><th>SN</th><th>Code</th><th>Material</th><th>Type</th><th>Total Received</th><th>Current Qty</th><th>Used</th><th>Unit</th><th>Alert</th></tr></thead><tbody>${stockItems.map((i, idx) => { const totalRec = window.getInventoryTotalReceived(i.id); const totalCur = window.getInventoryTotalQty(i.id); return `<tr><td>${idx + 1}</td><td><span class="code-display">${i.InventoryCode}</span></td><td>${escapeHtml(i.MaterialName)}<br><span style="font-size:11px;color:var(--gray-500);">${escapeHtml(i.Make)}</span></td><td><span class="badge badge-gray">${i.MaterialType}</span></td><td>${totalRec}</td><td class="qty-display ${window.getQtyClass(i.id)}">${totalCur}</td><td>${(totalRec - totalCur).toFixed(2)}</td><td>${i.Unit}</td><td>${window.getAlertBadge(i.id)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
            break;
        case 'lowStock':
            const lowItems = DB.inventory.filter(i => i.Status === 'Active' && window.getAlertStatus(i.id) === 'low');
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Low Stock Alert Report</h2><span class="badge badge-danger">${lowItems.length} items</span></div><div class="card-body">${reportControls}${lowItems.length === 0 ? '<div class="alert alert-success">All materials are above alert threshold</div>' : `<table class="data-table"><thead><tr><th>SN</th><th>Code</th><th>Material</th><th>Current Qty</th><th>Threshold</th><th>Unit</th><th>Batches</th></tr></thead><tbody>${lowItems.map((i, idx) => `<tr><td>${idx + 1}</td><td><span class="code-display">${i.InventoryCode}</span></td><td>${escapeHtml(i.MaterialName)}</td><td class="qty-display low">${window.getInventoryTotalQty(i.id)}</td><td>${i.AlertThreshold}%</td><td>${i.Unit}</td><td>${DB.batches.filter(b => b.InventoryID === i.id && b.Status === 'Active').map(b => escapeHtml(b.BatchCode)).join(', ')}</td></tr>`).join('')}</tbody></table>`}</div></div>`;
            break;
        case 'expiry':
            const t = new Date(); const expBatches = DB.batches.filter(b => Math.ceil((new Date(b.ExpiryDate) - t) / (1000 * 60 * 60 * 24)) <= 90).sort((a, b) => new Date(a.ExpiryDate) - new Date(b.ExpiryDate));
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Expiry Alert Report</h2><span class="badge badge-warning">${expBatches.length} batches</span></div><div class="card-body">${reportControls}${expBatches.length === 0 ? '<div class="alert alert-success">No batches nearing expiration</div>' : `<table class="data-table"><thead><tr><th>SN</th><th>Batch</th><th>Material</th><th>Lot</th><th>Expiry</th><th>Days Left</th><th>Current Qty</th></tr></thead><tbody>${expBatches.map((b, idx) => { const daysLeft = Math.ceil((new Date(b.ExpiryDate) - t) / (1000 * 60 * 60 * 24)); const cls = daysLeft <= 30 ? 'low' : 'warning'; return `<tr><td>${idx + 1}</td><td><span class="code-display">${escapeHtml(b.BatchCode)}</span></td><td>${escapeHtml(getLookup(b.InventoryID, 'inventory')?.MaterialName || 'N/A')}</td><td>${escapeHtml(b.LotNumber)}</td><td class="qty-display ${cls}">${formatDate(b.ExpiryDate)}</td><td class="qty-display ${cls}">${daysLeft} days</td><td>${b.CurrentQuantity} ${b.Unit}</td></tr>`; }).join('')}</tbody></table>`}</div></div>`;
            break;
        case 'studyConsumption':
            const studyUsage = {}; DB.usage.forEach(u => { if (!studyUsage[u.StudyID]) studyUsage[u.StudyID] = []; studyUsage[u.StudyID].push(u); });
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Study-wise Consumption Report</h2></div><div class="card-body">${reportControls}<table class="data-table"><thead><tr><th>SN</th><th>Study</th><th>Type</th><th>Total Records</th><th>Materials Used</th></tr></thead><tbody>${Object.entries(studyUsage).map(([studyId, usages], idx) => { const study = getLookup(studyId, 'studies'); const materials = [...new Set(usages.map(u => u.InventoryID))].length; return `<tr><td>${idx + 1}</td><td>${study ? escapeHtml(study.StudyName) : 'N/A'}</td><td><span class="badge badge-info">${study ? study.StudyType : 'N/A'}</span></td><td>${usages.length}</td><td>${materials}</td></tr>`; }).join('')}</tbody></table></div></div>`;
            break;
        case 'facultyConsumption':
            const facUsage = {}; DB.usage.forEach(u => { if (!facUsage[u.FacultyID]) facUsage[u.FacultyID] = []; facUsage[u.FacultyID].push(u); });
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Faculty-wise Consumption Report</h2></div><div class="card-body">${reportControls}<table class="data-table"><thead><tr><th>SN</th><th>Faculty</th><th>Department</th><th>Total Records</th><th>Materials Used</th></tr></thead><tbody>${Object.entries(facUsage).map(([facId, usages], idx) => { const fac = getLookup(facId, 'faculty'); const dept = fac ? getLookup(fac.DepartmentID, 'departments') : null; const materials = [...new Set(usages.map(u => u.InventoryID))].length; return `<tr><td>${idx + 1}</td><td>${fac ? escapeHtml(fac.FacultyName) : 'N/A'}</td><td>${dept ? escapeHtml(dept.DepartmentName) : 'N/A'}</td><td>${usages.length}</td><td>${materials}</td></tr>`; }).join('')}</tbody></table></div></div>`;
            break;
        case 'deptConsumption':
            const deptUsage = {}; DB.usage.forEach(u => { if (!deptUsage[u.DepartmentID]) deptUsage[u.DepartmentID] = []; deptUsage[u.DepartmentID].push(u); });
            container.innerHTML = `<div class="card"><div class="card-header"><h2>Department-wise Consumption Report</h2></div><div class="card-body">${reportControls}<table class="data-table"><thead><tr><th>SN</th><th>Department</th><th>Total Records</th><th>Materials Used</th><th>Users</th></tr></thead><tbody>${Object.entries(deptUsage).map(([deptId, usages], idx) => { const dept = getLookup(deptId, 'departments'); const materials = [...new Set(usages.map(u => u.InventoryID))].length; const users = [...new Set(usages.map(u => u.UserID))].length; return `<tr><td>${idx + 1}</td><td>${dept ? escapeHtml(dept.DepartmentName) : 'N/A'}</td><td>${usages.length}</td><td>${materials}</td><td>${users}</td></tr>`; }).join('')}</tbody></table></div></div>`;
            break;
    }
};

window.filterReportTable = function () {
    const term = document.getElementById('reportSearch').value.toLowerCase();
    document.querySelectorAll('#reportContent .data-table tbody tr').forEach(row => { row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none'; });
};

export function attachTableSort() {
    document.querySelectorAll('.data-table th').forEach(th => {
        if (th.textContent.trim().toLowerCase() === 'actions') return;
        th.style.cursor = 'pointer'; th.style.userSelect = 'none';
        if (!th.querySelector('.sort-icon')) th.innerHTML += ' <span class="sort-icon" style="font-size:10px; opacity:0.3; margin-left:4px;">&#x2195;</span>';
        th.onclick = function () {
            const table = th.closest('table'); const tbody = table.querySelector('tbody'); const rows = Array.from(tbody.querySelectorAll('tr'));
            if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('No '))) return;
            const index = Array.from(th.parentNode.children).indexOf(th); const isAscending = th.classList.contains('sort-asc');
            table.querySelectorAll('th').forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); const icon = h.querySelector('.sort-icon'); if (icon) { icon.innerHTML = '&#x2195;'; icon.style.opacity = '0.3'; } });
            th.classList.toggle('sort-asc', !isAscending); th.classList.toggle('sort-desc', isAscending);
            const icon = th.querySelector('.sort-icon'); if (icon) { icon.innerHTML = isAscending ? '&#x2193;' : '&#x2191;'; icon.style.opacity = '1'; }
            rows.sort((a, b) => {
                let aText = a.children[index].textContent.trim(); let bText = b.children[index].textContent.trim();
                let aNum = parseFloat(aText.replace(/[^0-9.-]+/g, "")); let bNum = parseFloat(bText.replace(/[^0-9.-]+/g, ""));
                let aDate = Date.parse(aText); let bDate = Date.parse(bText);
                if (!isNaN(aDate) && !isNaN(bDate) && aText.length > 8) return isAscending ? bDate - aDate : aDate - bDate;
                else if (!isNaN(aNum) && !isNaN(bNum) && /\d/.test(aText)) return isAscending ? bNum - aNum : aNum - bNum;
                return isAscending ? bText.localeCompare(aText) : aText.localeCompare(bText);
            });
            tbody.append(...rows);
        };
    });
}