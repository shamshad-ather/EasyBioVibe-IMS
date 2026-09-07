import { apiCall } from '../core/api.js';
import { DB, CONSTANTS, loadRealData } from '../core/store.js';
import { showToast, escapeHtml } from '../core/utils.js';

window.togglePassword = function(btn) {
    const input = btn.previousElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        // Eye-Slash (Hide) SVG
        btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>`;
    } else {
        input.type = 'password';
        // Eye (Show) SVG
        btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    }
};

window.handleSetup = async function(e) {
    e.preventDefault();
    const pw = document.getElementById('setupPassword').value;
    const cpw = document.getElementById('setupConfirmPassword').value;
    const errorDiv = document.getElementById('setupError');
    
    if (pw !== cpw) {
        errorDiv.textContent = "Passwords do not match.";
        errorDiv.style.display = 'block';
        return;
    }
    
    const payload = {
        system_mode: document.getElementById('setupSystemMode').value,
        backup_path: document.getElementById('setupBackupPath').value,
        lab_name: document.getElementById('setupLabName').value,
        lab_abbrev: document.getElementById('setupLabAbbrev').value,
        username: document.getElementById('setupUsername').value,
        password: pw,
        is_faculty: document.getElementById('setupIsFaculty').checked,
        department_name: document.getElementById('setupDeptName').value,
        designation: document.getElementById('setupDesignation').value
    };
    
    const res = await apiCall('/api/setup', payload, 'POST');
    
    if (res.status === 'success') {
        document.getElementById('setupOverlay').style.display = 'none';
        DB.settings.currentUser = payload.username;
        DB.settings.currentRole = 'Admin';
        
        await loadRealData();
        window.populateQASelects();
        document.getElementById('qaSetupOverlay').style.display = 'flex';
        showToast('System configured successfully! Please secure your account.', 'success');
    } else {
        errorDiv.textContent = res.message;
        errorDiv.style.display = 'block';
    }
};

window.handleLogin = async function(e) {
    e.preventDefault();
    const payload = { 
        username: document.getElementById('username').value, 
        password: document.getElementById('password').value 
    };
    
    const res = await apiCall('/login', payload, 'POST');
    
    if (res.status === 'success') {
        document.getElementById('loginOverlay').style.display = 'none';
        DB.settings.currentUser = res.username;
        DB.settings.currentRole = res.role;
        document.getElementById('currentUserDisplay').textContent = `Signed in as ${res.username}`;
        document.getElementById('currentRole').textContent = res.role;
        
        await loadRealData();

        if (res.role === 'Admin' && !res.qa_configured) {
            window.populateQASelects();
            document.getElementById('qaSetupOverlay').style.display = 'flex';
        } else {
            window.showAppWrapper();
            if (res.must_change_password) {
                showToast('Please change your temporary password in My Profile.', 'info');
            }
        }
    } else {
        const errDiv = document.getElementById('loginError');
        errDiv.textContent = res.message;
        errDiv.style.display = 'block';
    }
};

window.showAppWrapper = function() {
    document.getElementById('qaSetupOverlay').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'block';
    window.navigateTo('home');
};

window.populateQASelects = function() {
    const opts = '<option value="">Select a security question...</option>' + CONSTANTS.SECURITY_QUESTIONS.map(q => `<option value="${q}">${q}</option>`).join('');
    document.getElementById('qa_q1').innerHTML = opts;
    document.getElementById('qa_q2').innerHTML = opts;
    document.getElementById('qa_q3').innerHTML = opts;
};

window.saveQASetup = async function(e) {
    e.preventDefault();
    const q1 = document.getElementById('qa_q1').value, q2 = document.getElementById('qa_q2').value, q3 = document.getElementById('qa_q3').value;
    const errorDiv = document.getElementById('qaSetupError');

    if (!q1 || !q2 || !q3) { errorDiv.textContent = "Please select three questions."; errorDiv.style.display = 'block'; return; }
    if (new Set([q1, q2, q3]).size !== 3) { errorDiv.textContent = "Please select three distinct questions."; errorDiv.style.display = 'block'; return; }

    const payload = {
        q1: q1, a1: document.getElementById('qa_a1').value,
        q2: q2, a2: document.getElementById('qa_a2').value,
        q3: q3, a3: document.getElementById('qa_a3').value
    };

    const res = await apiCall('/api/qa/setup', payload, 'POST');
    if (res.status === 'success') {
        window.showAppWrapper();
        showToast('Security questions saved.', 'success');
    } else {
        errorDiv.textContent = res.message; 
        errorDiv.style.display = 'block';
    }
};

window.openForgotPassword = function() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('forgotUsername').value = '';
    document.getElementById('forgotStep1Error').style.display = 'none';
    document.getElementById('forgotStep1Overlay').style.display = 'flex';
};

window.closeForgotFlow = function() {
    document.getElementById('forgotStep1Overlay').style.display = 'none';
    document.getElementById('forgotStep2Overlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
};

let activeForgotUsername = '';

window.submitForgotUser = async function(e) {
    e.preventDefault();
    const un = document.getElementById('forgotUsername').value;
    const errorDiv = document.getElementById('forgotStep1Error');
    
    const res = await apiCall('/api/qa/get_questions', {username: un}, 'POST');
    if (res.status === 'success') {
        activeForgotUsername = un;
        document.getElementById('lbl_q1').textContent = res.q1;
        document.getElementById('lbl_q2').textContent = res.q2;
        document.getElementById('lbl_q3').textContent = res.q3;
        document.getElementById('ans_1').value = '';
        document.getElementById('ans_2').value = '';
        document.getElementById('ans_3').value = '';
        document.getElementById('forgotNewPass').value = '';
        document.getElementById('forgotConfirmPass').value = '';
        
        document.getElementById('forgotStep1Overlay').style.display = 'none';
        document.getElementById('forgotStep2Overlay').style.display = 'flex';
    } else {
        errorDiv.textContent = res.message || "Connection error."; 
        errorDiv.style.display = 'block';
    }
};

window.submitForgotReset = async function(e) {
    e.preventDefault();
    const np = document.getElementById('forgotNewPass').value;
    const cp = document.getElementById('forgotConfirmPass').value;
    const errorDiv = document.getElementById('forgotStep2Error');
    
    if (np !== cp) { errorDiv.textContent = "New passwords do not match."; errorDiv.style.display = 'block'; return; }

    const payload = {
        username: activeForgotUsername,
        a1: document.getElementById('ans_1').value,
        a2: document.getElementById('ans_2').value,
        a3: document.getElementById('ans_3').value,
        new_password: np
    };

    const res = await apiCall('/api/qa/reset_password', payload, 'POST');
    if (res.status === 'success') {
        showToast('Password reset successfully! Please log in.', 'success');
        window.closeForgotFlow();
    } else {
        errorDiv.textContent = res.message || "Connection error."; 
        errorDiv.style.display = 'block';
    }
};