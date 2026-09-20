import { apiCall } from './core/api.js';
import { DB, CONSTANTS, loadRealData } from './core/store.js';
import { showToast, escapeHtml, openModal, closeModal } from './core/utils.js';

// Import side-effects (binds inline HTML functions to window)
import './modules/auth.js';
import './modules/inventory.js';
import './modules/equipment.js';

// Import Specific Renderers
import { renderInventory, renderBatches } from './modules/inventory.js';
import { renderEquipment } from './modules/equipment.js';
import { renderDepartmentStack, renderFacultyStack, renderStudyStack, renderStudyInventory, renderFaculty, renderStudies, renderUsers, renderVendors, renderDocuments, renderHistoryLog, renderGlobalUsage } from './modules/masters.js';
import { renderReports, attachTableSort } from './modules/reports.js';

// --- Global Router State ---
window.currentPage = 'home';
window.drillContext = { departmentId: null, facultyId: null, studyId: null, reportId: null };

// --- Home Dashboard Renderer ---
function renderHome(content) {
    const singleDeptId = DB.departments.find(d => d.Status === 'Active')?.id || '';
    
    // Dynamically calculate equipment due for maintenance/calibration in next 30 days
    const today = new Date();
    const maintAlerts = DB.equipment.filter(e => e.status !== 'Decommissioned').filter(e => {
        const docs = DB.documents.filter(d => d.LinkedEquipID === e.id && CONSTANTS.COMPLIANCE_DOCS.includes(d.DocumentType) && d.ValidTo).sort((a,b) => new Date(a.ValidTo) - new Date(b.ValidTo));
        if(docs.length === 0) return false;
        return Math.ceil((new Date(docs[0].ValidTo) - today) / (1000*60*60*24)) <= 30;
    }).length;

    content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
            <div><h1 class="page-title animate-welcome">Welcome to <span class="highlight-lab">${escapeHtml(DB.settings.lab_abbrev)}</span>-IMS</h1><p class="page-subtitle">${escapeHtml(DB.settings.lab_name)} - Inventory Management System</p></div>
            <button class="btn btn-primary btn-lg" onclick="openGlobalUsageModal()"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Record Usage</button>
        </div>
        <div class="home-cards">
            ${DB.settings.system_mode !== 'Single' ? `<div class="home-card departments" onclick="navigateTo('departmentStack')"><div class="icon"><svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div><h2>Departments</h2><p>Browse inventory and activities by department</p></div>` : `<div class="home-card departments" onclick="navigateTo('studies')"><div class="icon"><svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg></div><h2>Studies & Projects</h2><p>Browse inventory and activities by Study</p></div>`}
            <div class="home-card inventory" onclick="navigateTo('inventory')"><div class="icon"><svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div><h2>Inventory</h2><p>Access master material catalog and current stock levels</p></div>
        </div>
        
        <div class="stats-grid" style="max-width:1000px; margin:0 auto; display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('inventory')"><div class="label">Total Materials</div><div class="value">${DB.inventory.length}</div></div>
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('batches')"><div class="label">Active Batches</div><div class="value">${DB.batches.filter(b=>b.Status==='Active').length}</div></div>
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('reports', {reportId: 'usageRecord'})"><div class="label">Usage Records</div><div class="value">${DB.usage.length}</div></div>
            
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('equipment')"><div class="label">Assets & Equip</div><div class="value">${DB.equipment.filter(e=>e.status!=='Decommissioned').length}</div></div>
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--warning)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('reports', {reportId: 'equipMaintenance'})"><div class="label">Maintenance Alerts</div><div class="value" style="color: ${maintAlerts > 0 ? 'var(--warning)' : 'inherit'};">${maintAlerts}</div></div>
            <div class="stat-card" style="cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--danger)'" onmouseout="this.style.borderColor='var(--gray-200)'" onclick="navigateTo('reports', {reportId: 'lowStock'})"><div class="label">Low Stock Alerts</div><div class="value alert">${DB.inventory.filter(i=>window.getAlertStatus(i.id)==='low').length}</div></div>
        </div>
    `;
}

// --- System Settings Renderer ---
function renderSettings(content) {
    if (DB.settings.currentRole !== 'Admin') { content.innerHTML = `<div class="alert alert-danger">Access Denied. Administrator role required.</div>`; return; }
    content.innerHTML = `
        <h1 class="page-title">System Settings</h1><p class="page-subtitle">Configure application branding and properties</p>
        <div class="card" style="max-width:600px;"><div class="card-body">
            <form onsubmit="saveSettings(event)">
                <div class="form-group"><label>System Mode</label><input type="text" class="form-control" value="${DB.settings.system_mode === 'Single' ? 'Single Lab' : 'Centralized Facility'}" disabled></div>
                <div class="form-group"><label>Full Lab Name</label><input type="text" class="form-control" id="sysLabName" value="${escapeHtml(DB.settings.lab_name)}" required></div>
                <div class="form-group"><label>Lab Abbreviation (Header Branding)</label><input type="text" class="form-control" id="sysLabAbbrev" value="${escapeHtml(DB.settings.lab_abbrev)}" required></div>
                <div class="form-group"><label>Institution Prefix (Smart IDs)</label><input type="text" class="form-control" id="sysInstPrefix" value="${escapeHtml(DB.settings.institution_prefix || '')}" placeholder="e.g., MGMMCNERUL"></div>
                <div class="form-group">
                    <label>Safe Backup Directory Path</label>
                    <div style="display:flex;gap:10px;">
                        <input type="text" class="form-control" id="sysBackupPath" value="${escapeHtml(DB.settings.backup_path || '')}" placeholder="e.g., D:/Backups" style="flex:1;">
                        <button type="button" class="btn btn-secondary" onclick="browseFolder()">Browse</button>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
        </div></div>
        <div class="card" style="max-width:600px;margin-top:20px;"><div class="card-header"><h2>Database</h2></div><div class="card-body">
            <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px;">Export a full backup, or move this instance to a new system by exporting here and importing on the other machine.</p>
            <a href="/api/export_db" class="btn btn-secondary" style="margin-bottom:20px;">Export Database</a>
            <div style="border-top:1px solid var(--line);padding-top:16px;">
                <div class="form-group"><label>Import Database</label><input type="file" class="form-control" id="importDbFile" accept=".db"></div>
                <button type="button" class="btn btn-secondary" onclick="importDatabase()">Import & Replace</button>
            </div>
        </div></div>
    `;
}

window.saveSettings = async function(e) {
    e.preventDefault();
    const payload = { 
        lab_name: document.getElementById('sysLabName').value, 
        lab_abbrev: document.getElementById('sysLabAbbrev').value, 
        institution_prefix: document.getElementById('sysInstPrefix').value,
        backup_path: document.getElementById('sysBackupPath').value 
    };
    const res = await apiCall('/api/settings', payload, 'POST');
    if (res.status === 'success') { await applyBranding(); showToast('Settings updated', 'success'); } else showToast('Error saving settings', 'error');
};

window.importDatabase = async function() {
    const fileInput = document.getElementById('importDbFile');
    if (!fileInput.files.length) { showToast('Choose a .db file first', 'error'); return; }
    if (!confirm('This replaces the current database with the imported file. Continue?')) return;
    
    const formData = new FormData(); 
    formData.append('dbfile', fileInput.files[0]);
    try { 
        const res = await fetch('/api/import_db', { method: 'POST', body: formData }); 
        const result = await res.json(); 
        if (result.status === 'success') showToast(result.message, 'success'); 
        else showToast(result.message, 'error'); 
    } catch (err) { showToast('Connection error', 'error'); }
};

window.browseFolder = async function() {
    try {
        const res = await apiCall('/api/pick_folder', {}, 'POST');
        if (res.status === 'success' && res.path) {
            document.getElementById('sysBackupPath').value = res.path;
        } else if (res.status !== 'cancelled') {
            showToast(res.message || 'Error opening folder picker', 'error');
        }
    } catch (err) {
        showToast('Connection error.', 'error');
    }
};

async function applyBranding() {
    const res = await apiCall('/api/settings', null, 'GET');
    Object.assign(DB.settings, res);
    
    const vStr = DB.settings.app_version ? ` ${DB.settings.app_version}` : '';
    document.title = `${DB.settings.lab_abbrev}-IMS - ${DB.settings.lab_name}`;
    document.getElementById('headerAppName').textContent = `${DB.settings.lab_abbrev}-IMS${vStr}`;
    document.getElementById('headerLabAbbrev').textContent = DB.settings.lab_abbrev;
    document.getElementById('headerLabName').textContent = DB.settings.lab_name;
    
    const footerSpan = document.querySelector('.dev-footer span');
    if (footerSpan) footerSpan.textContent = `${DB.settings.lab_abbrev}-IMS${vStr} | Vibed By Shamshad Ather`;
    
    if (document.getElementById('navSettings')) document.getElementById('navSettings').style.display = DB.settings.currentRole === 'Admin' ? 'flex' : 'none';
    if (DB.settings.system_mode === 'Single') document.querySelectorAll('.dept-dependent').forEach(el => el.style.display = 'none');
}

// --- Global Router Engine ---
window.navigateTo = function(page, params) {
    window.currentPage = page;
    if (params) Object.assign(window.drillContext, params);
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    let activeNav = page;
    if (['facultyStack', 'studyStack', 'studyInventory'].includes(page)) activeNav = 'departmentStack'; 
    const navItem = document.querySelector(`.nav-item[data-page="${activeNav}"]`);
    if (navItem) navItem.classList.add('active');
    
    window.renderCurrentPage();
    window.scrollTo(0, 0);
};

window.renderCurrentPage = function() {
    const activeElement = document.activeElement; 
    const activeId = activeElement ? activeElement.id : null;
    const content = document.getElementById('mainContent');
    
    const pages = { 
        home: renderHome, 
        departmentStack: renderDepartmentStack, facultyStack: renderFacultyStack, studyStack: renderStudyStack, studyInventory: renderStudyInventory, 
        departments: renderDepartmentStack, faculty: renderFaculty, studies: renderStudies, users: renderUsers, 
        equipment: renderEquipment, inventory: renderInventory, batches: renderBatches, vendors: renderVendors, documents: renderDocuments, 
        history: renderHistoryLog, reports: renderReports, settings: renderSettings, globalUsage: renderGlobalUsage 
    };
    
    if(pages[window.currentPage]) {
        pages[window.currentPage](content);
    } else {
        content.innerHTML = `<h2>Module Not Found</h2>`;
    }
    
    if (activeId && document.getElementById(activeId) && document.getElementById(activeId).tagName === 'INPUT') { 
        const el = document.getElementById(activeId); el.focus(); 
        if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); 
    }
    setTimeout(attachTableSort, 50);
};

// --- Profile Modal UI ---
window.openProfileModal = function() {
    const u = DB.users.find(u => u.UserName === DB.settings.currentUser);
    if (!u) { showToast('User profile data unavailable.', 'error'); return; }
    openModal('My Profile', `
        <form id="profileForm" onsubmit="saveProfile(event)">
            <div class="form-group"><label>Username</label><input type="text" class="form-control" name="UserName" value="${escapeHtml(u.UserName)}" required></div>
            <div class="form-group"><label>Department</label><input type="text" class="form-control" name="Department" value="${escapeHtml(u.Department || '')}"></div>
            <div class="form-group"><label>Designation</label><select class="form-control" name="Designation">${CONSTANTS.DESIGNATIONS.map(d => `<option value="${d}" ${u.Designation===d?'selected':''}>${d}</option>`).join('')}</select></div>
        </form>
        <hr style="margin:20px 0;border:none;border-top:1px solid var(--line);">
        <form id="passwordForm" onsubmit="saveOwnPassword(event)">
            <p style="font-size:13px;font-weight:600;margin-bottom:4px;">Change Password</p>
            <div class="form-group"><label>Current Password</label><input type="password" class="form-control" name="CurrentPassword" required></div>
            <div class="form-group"><label>New Password</label><input type="password" class="form-control" name="NewPassword" minlength="6" required></div>
            <div class="form-group"><label>Retype New Password</label><input type="password" class="form-control" name="ConfirmPassword" minlength="6" required></div>
            <div id="passwordFormError" class="auth-error"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Update Password</button>
        </form>
    `, null, `<button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button><button type="button" class="btn btn-primary" onclick="document.getElementById('profileForm').dispatchEvent(new Event('submit', {cancelable: true}))">Save Profile</button>`);
};

window.saveProfile = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('profileForm')));
    const res = await apiCall('/api/profile', { name: data.UserName, department: data.Department, designation: data.Designation }, 'POST');
    if (res.status === 'success') { showToast('Profile updated!', 'success'); if (res.username !== DB.settings.currentUser) DB.settings.currentUser = res.username; await loadRealData(); closeModal(); if (window.currentPage === 'users') window.renderCurrentPage(); } else showToast(res.message, 'error');
};

window.saveOwnPassword = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(document.getElementById('passwordForm')));
    const errorDiv = document.getElementById('passwordFormError'); errorDiv.style.display = 'none';
    if (data.NewPassword !== data.ConfirmPassword) { errorDiv.textContent = 'Passwords do not match.'; errorDiv.style.display = 'block'; return; }
    const res = await apiCall('/api/profile/password', { current_password: data.CurrentPassword, new_password: data.NewPassword }, 'POST');
    if (res.status === 'success') { showToast('Password updated!', 'success'); document.getElementById('passwordForm').reset(); } else { errorDiv.textContent = res.message || 'Could not update password'; errorDiv.style.display = 'block'; }
};

// Start System
document.addEventListener('DOMContentLoaded', async () => {
    // --- NEW: Attach Event Listeners to Sidebar Navigation ---
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent the default '#' anchor jump
            const page = nav.getAttribute('data-page');
            if (page) {
                window.navigateTo(page);
            }
        });
    });
    // ---------------------------------------------------------

    try {
        const data = await apiCall('/api/status', null, 'GET');
        
        if (data.setup_required) {
            const setupDes = document.getElementById('setupDesignation');
            if(setupDes) setupDes.innerHTML = '<option value="HoD">HoD</option>';
            document.getElementById('setupOverlay').style.display = 'flex';
        } else if (data.logged_in) {
            DB.settings.currentUser = data.username;
            DB.settings.currentRole = data.role;
            await applyBranding();
            
            document.getElementById('currentUserDisplay').textContent = `Signed in as ${data.username}`;
            document.getElementById('currentRole').textContent = data.role;
            
            await loadRealData();
            document.getElementById('appWrapper').style.display = 'block';
            window.navigateTo('home');
        } else {
            await applyBranding();
            document.getElementById('loginTitle').textContent = (DB.settings.lab_abbrev || 'LAB') + ' Login';
            document.getElementById('loginOverlay').style.display = 'flex';
        }
    } catch (e) {
        console.error("Boot error:", e);
    } finally {
        document.getElementById('bootSplash').classList.add('hide');
    }
    
    document.getElementById('btnLogout').addEventListener('click', async () => {
        await apiCall('/logout', {}, 'POST');
        location.href = '/';
    });
    
    document.getElementById('btnMyProfile').addEventListener('click', () => { window.openProfileModal(); });

    setInterval(() => { apiCall('/api/ping', {}, 'POST').catch(()=>{}); }, 5000);
});