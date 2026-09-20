# EasyBioVibe-IMS: Project Philosophy & Orchestration

## The Traceability Journey
This system acts as a complete traceability map for NABL/ISO compliance. Data flows in a specific, unbroken chain:
**Departments -> Studies -> Users -> Usage Logs.** 
Every drop of material consumed must be mapped to a specific Batch, used by an authorized User, for a specific Study, inside a Department.

## Unified Users & Authentication
There is no separation between "Software Accounts" and "Lab Personnel". Everyone is a User.
*   **True Admin:** The very first user created during the initial setup wizard. They have ultimate control and cannot be deleted or demoted.
*   **Admins:** Upgraded by the True Admin. They can edit master lists, inventory, and system settings.
*   **Standard Users:** Lab personnel (Scholars, Techs). They can log in, search inventory, and log usage for their assigned Studies, but have no access to System Settings.
*   **The Security Gate:** Because the app is offline (no email), password recovery uses Security Questions. When a Standard User is upgraded to an Admin, the system MUST intercept their next login and force them to configure their offline recovery questions before accessing the app.

## Document Management & Compliance
The system features a dedicated **Documents** hub for storing Material Safety Data Sheets (MSDS), Certificates of Analysis (COA), and Annual Maintenance Contracts (AMCs). These documents are uploaded locally, linked securely to specific Equipment or Inventory records, and monitored for Expiry Dates to trigger UI alerts.

## Automated Offline Backups
Data security relies on an automated physical backup loop. The Admin configures a "Secondary Backup Storage Site" (e.g., an external drive or mapped local folder) via the System Settings. The backend silently replicates the `.db` file to this path upon every major transaction.
True Admin: The very first user created during the initial setup wizard. They have ultimate control and cannot be deleted or demoted.

## Semantic ID Nomenclature (Smart Asset Tagging)
Raw database integer IDs are NEVER exposed to the user. All entities must generate and display a "Smart ID" based on System Settings.
*   **Format:** `{InstitutionPrefix}-{LabAbbrev}-{EntityCode}{ZeroPaddedNumber}` (e.g., `MGMMCNERUL-CIRL-EQ001`).
*   **Entity Codes:** Departments (`DPT`), Studies (`STU`), Users (`USR`), Equipment (`EQ`), Inventory (`INV`), Batches (`BAT`), Documents (`DOC`).

## Sub-Domain Routing
*   For Visual Drill-Down UX and Branding -> **Read `frontend.md`**
*   For PyInstaller integration and native OS APIs -> **Read `backend.md`**
*   For the relational schema and User-Study mappings -> **Read `database.md`**

# Frontend UI/UX Guidelines

## Technology Stack
*   **Strictly Vanilla ES6 JavaScript.** React, Vue, jQuery, or any external SPA frameworks are FORBIDDEN.
*   CSS utilizes native variables (`var(--primary)`, `var(--card-bg)`) to support Dark/Light Mode.

## Dynamic Branding Loop
The interface dynamically re-brands itself. The `window.applyBranding()` function pulls `DB.settings.lab_name` and `DB.settings.lab_abbrev` from the SQLite database, and the `APP_VERSION` injected from `VERSION.md`. These are placed into `#brand-logo-text` and `#brand-header-title`. 
*   **Footer Rule:** The footer MUST rigidly equal: `{Lab_Abbrev}-IMS {Version} | Vibed By Shamshad Ather`.

## The Visual Drill-Down (The Stack Engine)
Do not dump massive, disconnected tables on the user. Use a visual funnel consisting of responsive CSS Grid cards (`.home-card`):
1. User sees a grid of **Departments**.
2. Clicking a Department transitions the UI to show the **Studies** within that department.
3. Clicking a Study shows the **Users** assigned to it and the **Inventory** consumed by it.
*   *UI Elements:* Master records must use card grids. Raw logs/records must use `.data-table` classes.

## Smart Search & Interactions
*   **Boolean Autocomplete:** Inventory/Equipment selections MUST use the custom multi-word boolean search dropdown instead of standard HTML `<select>` tags.
*   **Multi-Select Chips:** Assigning Users to a Study or selecting Equipment during a transaction MUST render as dynamic, removable visual "chips" displaying `Name (Code)`.
*   **Semantic ID Badges:** Wherever a Smart ID (e.g., `CIRL-EQ001`) is displayed, it MUST be wrapped in a styling badge with a monospace font (`<span style="font-family: monospace;">`) for easy reading.

# Backend API & Server Guidelines

## Technology Stack & PyInstaller Rules (CRITICAL)
*   Python 3.11+, Flask (Modular Blueprint Architecture).
*   Because this application is compiled into a single executable, you MUST use the `resource_path(relative_path)` utility (leveraging `sys._MEIPASS`) when reading local files (templates, static, `VERSION.md`). Standard `os.path` will crash the compiled `.exe`.

## Native OS Integrations
*   **Folder Pickers:** For the Secondary Backup path, you MUST NOT use standard HTML text inputs for paths. You must route an API call to invoke the native OS folder picker using `tkinter.filedialog.askdirectory()`.
*   **Local File Storage (Documents):** Uploaded compliance PDFs/Images cannot be sent to S3/Cloud. They MUST be saved to a persistent, non-compiled local directory (e.g., `app_data/documents/` sitting relative to the user's host executable). Flask serves these via `send_from_directory()`.

## API Standards & Authentication
*   All endpoints require `@login_required` (except initial setup/auth).
*   Responses must be strictly formatted JSON: `jsonify({"status": "success", "data": ...})` or `{"status": "error", "message": "..."}`.
*   **The Security Gate Intercept:** If a user logs in and their `RequiresSecuritySetup` database flag is True, the API MUST signal the frontend to lock the UI and launch the Security Question configuration modal before returning standard dashboard data.

# SQLite Database & Schema Rules

## Core Engine
*   SQLite3 using the `sqlite3.Row` factory for dictionary-like API responses.
*   Auto-initializes tables on boot if missing.

## Smart ID Generation Engine
*   **Dual-ID System:** Tables must use a standard auto-incrementing integer `ID` as the Primary Key for fast joins. They must also have a `DisplayID` (TEXT) column for the Semantic ID.
*   **Generation:** On INSERT, query the auto-increment ID, pad it with leading zeros, and prepend the `InstitutionPrefix`, `LabAbbrev`, and Entity Code (e.g., `EQ`).
*   **Immutability:** Once generated, `DisplayID` is locked to preserve physical label validity, even if Lab Settings change later.

## The Relational Traceability Chain & User Mapping
*   **Many-to-Many Studies:** Users are assigned to a home Department. However, Users are assigned to Studies via a junction table (`User_Study_Assignments` mapping `UserID` to `StudyID`).
*   **Smart Filtering:** When a Standard User clicks "Record Usage," the backend MUST filter the available Studies to show ONLY the studies mapped to their `UserID` in the junction table. Admins see all.

## Inventory Math & Unit Conversions
*   **Batches vs Master:** `Inventory_Master` tracks the generic material. `Physical_Batches` tracks the received bottle/box (Expiry, Lot, PO).
*   **Multiplier Logic:** The database must mathematically translate the "Used Unit" into the "Batch Base Unit" upon logging usage to prevent negative stock. Batches shift from `Active` to `Depleted` automatically when `current_quantity == 0`.

## Audit Trails (NABL/ISO Compliance)
*   **No Silent Deletes:** Records are marked `Inactive` or `Decommissioned` via boolean flags. `DROP` or `DELETE` commands are FORBIDDEN on user data.
*   **History Logs:** Every Create, Update, or Delete operation MUST write to the `HistoryLog` table. Every consumption event writes to `Usage_Logs` capturing the Batch, User, Study, Date, and Equipment.


# EasyBioVibe-IMS: Dummy Inventory Seed Data

This document contains a realistic set of laboratory inventory data designed to test the database schema, the Smart ID generation, and the bulk Excel import logic. It is split into **Inventory Master** (the general catalog) and **Physical Batches** (the actual received items with lot numbers and expiry dates).

## 1. Inventory Master Catalog
This represents the generic materials available in the laboratory.

| Name | Category | Base Unit | Min Stock | CAS Number | Catalog Ref | Storage Location |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Tris Base, UltraPure | Chemical | g | 500 | 77-86-1 | TRIS-100 | Chem Cabinet A |
| Ethanol, 70% Molecular Grade | Solvent | mL | 1000 | 64-17-5 | ETH-70M | Flammable Cabinet |
| Microcentrifuge Tubes 1.5mL | Consumable | pcs | 2000 | N/A | MCT-15-C | Shelf 2B |
| Fetal Bovine Serum (FBS) | Reagent | mL | 500 | N/A | FBS-500-HI | Freezer -20°C (Rack 1) |
| Phosphate Buffered Saline (10X) | Buffer | L | 2 | N/A | PBS-10X-1L | Cold Room 4°C |
| Isopropanol, HPLC Grade | Solvent | mL | 2500 | 67-63-0 | ISO-HPLC | Flammable Cabinet |
| Pipette Tips, 200µL Filtered | Consumable | pcs | 5000 | N/A | PT-200-FLT | Shelf 2A |

---

## 2. Physical Batches (Received Stock)
This maps the actual physical bottles and boxes received from vendors to the Master items above.

| Master Item | Lot Number | PO Number | Received Date | Expiry Date | Initial Qty | Current Qty | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Tris Base, UltraPure | L-884920 | PO-2026-041 | 2026-08-15 | 2028-08-15 | 1000 | 1000 | Active |
| Tris Base, UltraPure | L-711002 | PO-2025-112 | 2025-10-10 | 2027-10-10 | 1000 | 150.5 | Active |
| Ethanol, 70% | B-99381A | PO-2026-042 | 2026-08-20 | 2029-08-20 | 4000 | 4000 | Active |
| Ethanol, 70% | B-88172C | PO-2025-088 | 2025-12-01 | 2028-12-01 | 4000 | 0 | Depleted |
| Microcentrifuge Tubes | MCT-26-A | PO-2026-050 | 2026-09-01 | N/A | 5000 | 4800 | Active |
| Fetal Bovine Serum | FBS-24X9 | PO-2026-015 | 2026-03-10 | 2027-03-10 | 500 | 225 | Active |
| FBS (Secondary) | FBS-24X9 | PO-2026-015 | 2026-03-10 | 2027-03-10 | 500 | 500 | Active |
| Pipette Tips, 200µL | PT-0992 | PO-2026-060 | 2026-09-15 | N/A | 10000 | 10000 | Active |

---

## 3. Usage Testing Scenarios
When testing the **Record Usage** interface and the `Usage_Logs` table, use these mathematical scenarios to verify the unit conversion logic:

1. **Simple Deduction:** Deduct `50` `mL` from the active Fetal Bovine Serum batch. *Expected outcome: Current Qty drops to 175.*
2. **Unit Conversion Deduction:** Deduct `2` `kg` from the 1000 `g` Tris Base batch. *Expected outcome: Backend must reject transaction due to insufficient stock (preventing negative values).*
3. **Depletion Trigger:** Deduct the exact remaining `150.5` `g` from the older Tris Base (L-711002). *Expected outcome: Batch Status automatically updates to `Depleted`.*