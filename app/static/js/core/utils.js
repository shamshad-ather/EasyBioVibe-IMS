export function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.animation = 'fadeOut 0.3s ease forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
}

export function openModal(title, bodyHtml, extraClass = '', footerHtml = '') {
    const modalContent = document.getElementById('modalContent');
    modalContent.className = `modal ${extraClass}`;
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">${footerHtml || '<button class="btn btn-secondary" onclick="closeModal()">Close</button>'}</div>
    `;
    document.getElementById('modalOverlay').classList.add('active');
}

export function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// Unit & Math Helpers
const UNIT_FAMILIES = { mass: ['kg', 'g', 'mg', 'ug'], volume: ['L', 'mL', 'uL'] };

export function getUnitFamily(unit) {
    if (UNIT_FAMILIES.mass.includes(unit)) return UNIT_FAMILIES.mass;
    if (UNIT_FAMILIES.volume.includes(unit)) return UNIT_FAMILIES.volume;
    return [unit];
}

export function getUnitMultiplier(unit) {
    const mass = {'kg': 1000.0, 'g': 1.0, 'mg': 0.001, 'ug': 0.000001};
    const vol = {'L': 1.0, 'mL': 0.001, 'uL': 0.000001};
    if (mass[unit] !== undefined) return mass[unit];
    if (vol[unit] !== undefined) return vol[unit];
    return 1.0; 
}

// Make globally available for inline HTML onclicks
window.closeModal = closeModal;