import { apiCall } from './api.js';

export const CONSTANTS = {
    STUDY_TYPES: ['Research','Diagnostics','Training','Validation','Quality Control','Utility','Other'],
    MATERIAL_TYPES: ['Reagent','Chemical','Plasticware','Glassware','Consumable','Kit','Buffer','Other'],
    UNITS: ['Nos','uL','mL','L','ug','mg','g','kg','Box','Pack','Bottle','Rxns','Tube','Vial','Kit'],
    EQUIP_STATUSES: ['Active', 'Under Maintenance', 'Quarantined', 'Decommissioned'],
    EVENT_TYPES: ['Breakdown', 'Repair', 'Preventive Maintenance (Action completed)', 'Verification', 'Decommissioned', 'Other'],
    DOC_TYPES: ['SOP','SDS','Manual','Certificate','Protocol','IQ','OQ','PQ','Calibration','AMC','CMC','Other'],
    COMPLIANCE_DOCS: ['Certificate', 'IQ', 'OQ', 'PQ', 'Calibration', 'AMC', 'CMC'],
    ROLES: ['Admin','Manager'],
    DESIGNATIONS: ['HoD', 'Faculty', 'Lab Tech', 'Student', 'JR', 'SR', 'Research Associate', 'Project Associate', 'Research Assistant', 'Project Assistant', 'Intern', 'IT personal', 'Other'],
    SECURITY_QUESTIONS: [
        "What is the first name of your oldest cousin?", "What was the name of your first pet?", "In what city or town was your mother born?",
        "What was the name of your favorite childhood teacher?", "What street did you live on in third grade?", "What was your childhood nickname?",
        "What is the name of the hospital where you were born?", "What was the make of your first car or bike?"
    ]
};

export const DB = {
    settings: { currentRole: 'Manager', currentUser: null, lab_name: 'Loading...', lab_abbrev: 'LAB', system_mode: 'Centralized' },
    departments: [], faculty: [], studies: [], users: [],
    inventory: [], batches: [], usage: [], vendors: [], documents: [], historyLog: [],
    equipment: [], equipmentEvents: [], userStudyAssignments: [], myStudies: []
};

export function getLookup(id, table) {
    return DB[table].find(x => String(x.id) === String(id));
}

export function generateId(prefix, table) {
    const count = DB[table].length + 1;
    const inst = DB.settings.institution_prefix || '';
    const lab = DB.settings.lab_abbrev || '';
    const pad = prefix === 'INV' ? 6 : (prefix === 'BAT' || prefix === 'USG' || prefix === 'HIS') ? 6 : 3;
    const num = String(count).padStart(pad, '0');
    
    let parts = [];
    if (inst) parts.push(inst);
    if (lab) parts.push(lab);
    parts.push(prefix + num);
    return parts.join('-');
}

export async function loadRealData() {
    const makeCode = (prefix, id, extCode) => (extCode && String(extCode).startsWith(prefix)) ? extCode : prefix + String(id).padStart(prefix.length > 3 ? 6 : 4, '0');

    try {
        const [inv, bat, usg, his, wiz, ven, doc, eq, eqEv, usa, mySt] = await Promise.all([
            apiCall('/api/inventory', null, 'GET'), apiCall('/api/batches', null, 'GET'), apiCall('/api/usage', null, 'GET'),
            apiCall('/api/history', null, 'GET'), apiCall('/api/wizard_data', null, 'GET'), apiCall('/api/vendors', null, 'GET'),
            apiCall('/api/documents', null, 'GET'), apiCall('/api/equipment', null, 'GET'), apiCall('/api/equipment/events', null, 'GET'),
            apiCall('/api/user_study_assignments', null, 'GET').catch(() => []), apiCall('/api/my_studies', null, 'GET').catch(() => [])
        ]);

        const safeArr = arr => Array.isArray(arr) ? arr : [];

        DB.inventory = safeArr(inv).map(i => ({ 
            ...i, 
            id: String(i.id), 
            InventoryCode: i.item_code || makeCode('INV', i.id), 
            MaterialName: i.material_name || 'Unnamed Material', 
            Make: i.make || '',
            Model: i.model || '',
            MaterialType: i.category || 'Other', 
            Unit: i.base_unit || 'Nos', 
            AlertThreshold: parseFloat(i.alert_threshold || 15), 
            PackQty: parseFloat(i.pack_qty || 1), 
            Status: i.status || 'Active' 
        }));

        DB.batches = safeArr(bat).map(b => ({ 
            ...b, 
            id: String(b.id), 
            BatchCode: b.batch_code || makeCode('BAT', b.id), 
            InventoryID: String(b.inventory_id), 
            PurchaseOrderNo: b.po_number || '',
            LotNumber: b.lot_number || '',
            ExpiryDate: b.expiry_date || '',
            DateFirstUsed: b.date_first_used || '',
            Remarks: b.remarks || '',
            DepartmentID: String(b.department_id || ''), 
            StudyID: String(b.study_id || ''), 
            VendorID: String(b.vendor_id || ''), 
            QuantityReceived: parseFloat(b.quantity_received || 0), 
            CurrentQuantity: parseFloat(b.current_quantity || 0), 
            Unit: b.unit || 'Nos', 
            Status: b.status || 'Active' 
        }));

        DB.usage = safeArr(usg).map(u => ({ 
            ...u, 
            id: String(u.id), 
            UsageCode: makeCode('USG', u.id), 
            InventoryID: String(u.inventory_id), 
            BatchID: String(u.batch_id), 
            UserID: String(u.user_id), 
            StudyID: String(u.study_id), 
            FacultyID: String(u.faculty_id || ''), 
            DepartmentID: String(u.department_id || ''), 
            EquipID: String(u.equip_id || ''), 
            UsageDate: u.timestamp ? u.timestamp.split(' ')[0] : '', 
            UsageTime: u.timestamp ? u.timestamp.split(' ')[1] : '', 
            QuantityUsed: parseFloat(u.quantity_used || 0), 
            Balance: (u.balance_after !== null && u.balance_after !== undefined) ? parseFloat(u.balance_after) : null, 
            Unit: u.unit_used || u.unit || '', 
            BatchCode: u.batch_code || '', 
            Remarks: u.remarks || '',
            RecordedBy: u.recorded_by || 'System'
        }));

        DB.historyLog = safeArr(his).map(h => ({ 
            ...h, 
            id: String(h.id), 
            HistoryCode: h.history_code, 
            Entity: h.entity, 
            EntityCode: h.entity_code, 
            FieldChanged: h.field_changed, 
            OldValue: h.old_value, 
            NewValue: h.new_value, 
            ChangedBy: h.changed_by, 
            ChangedDate: h.changed_date 
        }));
        
        DB.departments = safeArr(wiz?.departments).map(d => ({ 
            ...d, 
            id: String(d.id), 
            DepartmentCode: d.dept_code || makeCode('DEP', d.id), 
            DepartmentName: d.dept_name, 
            Status: d.status,
            Remarks: d.remarks || ''
        }));

        DB.faculty = safeArr(wiz?.faculty).map(f => {
            const dept = DB.departments.find(d => d.DepartmentName === f.department);
            return {
                ...f, 
                id: String(f.id), 
                FacultyCode: f.fac_code, 
                FacultyName: f.fac_name, 
                DepartmentID: dept ? dept.id : '', 
                Status: f.status 
            };
        });

        DB.studies = safeArr(wiz?.studies).map(s => ({ 
            ...s, 
            id: String(s.id), 
            StudyCode: s.study_code || makeCode('STD', s.id), 
            StudyName: s.study_name, 
            StudyType: s.study_type, 
            FacultyID: String(s.faculty_id || ''), 
            DepartmentID: String(s.department_id || ''), 
            Status: s.status,
            Description: s.description || ''
        }));
        
        DB.userStudyAssignments = safeArr(usa);
        DB.myStudies = safeArr(mySt).map(s => ({...s, id: String(s.id)}));

        DB.users = safeArr(wiz?.users).map(u => ({ 
            ...u, 
            id: String(u.id), 
            UserCode: u.user_name || makeCode('USR', u.id), 
            UserName: u.user_name, 
            StudyIDs: u.study_ids ? String(u.study_ids).split(',') : ['ALL'], 
            Role: u.role, 
            Status: u.status,
            Department: u.department || '',
            Designation: u.designation || ''
        }));
        
        DB.vendors = safeArr(ven).map(v => ({ 
            ...v, 
            id: String(v.id), 
            VendorCode: v.vendor_code || makeCode('VEN', v.id), 
            VendorName: v.vendor_name,
            ContactNumber: v.contact_number || '',
            Remarks: v.remarks || ''
        }));

        DB.documents = safeArr(doc).map(d => ({ 
            ...d, 
            id: String(d.id), 
            DocumentCode: d.document_code, 
            Title: d.title, 
            DocumentType: d.document_type, 
            Version: d.version || 'v1.0',
            LinkUrl: d.link_url || '',
            FilePath: d.file_path || '',
            Remarks: d.remarks || '',
            LinkedInventoryID: String(d.linked_inventory_id || ''), 
            LinkedEquipID: String(d.linked_equip_id || ''), 
            ValidFrom: d.valid_from || '', 
            ValidTo: d.valid_to || '' 
        }));

        DB.equipment = safeArr(eq).map(e => ({ 
            ...e, 
            id: String(e.id), 
            department_id: String(e.department_id || '') 
        }));

        DB.equipmentEvents = safeArr(eqEv).map(e => ({ 
            ...e, 
            id: String(e.id), 
            equip_id: String(e.equip_id) 
        }));

    } catch (error) {
        console.error("Data load failed:", error);
    }
}