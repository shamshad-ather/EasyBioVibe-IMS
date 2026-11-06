# EasyBio.Vibe IMS

**EasyBio.Vibe IMS** is a modern, local-first Laboratory Information and Inventory Management System (LIMS) designed for molecular biology, RT-qPCR, and academic research laboratories. It provides a secure, streamlined platform to manage reagents and consumables, maintain equipment compliance, track study allocations, and record material consumption with full audit trails.

---

## Key Features

- **Inventory & Batch Tracking**: Manage material stock, expiration dates, open-container dates, and lot numbers. Real-time depletion alerts and low-stock thresholds.
- **Studies & Project Allocation**: Centralized management of research, diagnostic, and QC activities. Assign studies to Principal Investigators (PIs) and Departments with automatic cross-mapping.
- **Equipment Management**: Track lab instruments, maintain service and calibration event logs, and record locations.
- **Cross-Platform Native Desktop Integration**: Native OS launcher generator creating Start Menu shortcuts on Windows (`.lnk`) and App Drawer entries on Linux (`.desktop`), directly bound to isolated Conda environments.
- **Smart Semantic IDs**: Auto-generated, human-readable IDs tailored to your institution (e.g., `INST-DEPT-INV000001`, `INST-DEPT-STU001`) with built-in legacy ID migration.
- **Unified Personnel & Roles**: Role-based access control (Admin, Manager, User) with flexible study assignment controls.
- **Document Compliance**: Securely upload and link SOPs, SDSs, and compliance certificates directly to materials and equipment.
- **Safe Native Backups**: Automatic heartbeat database backup on application close or idle, plus manual directory exports.
- **Local-First & Offline**: High-performance SQLite database with Write-Ahead Logging (WAL) for maximum reliability without internet dependence.

---

## Tech Stack

- **Backend**: Python 3.11+, Flask
- **Database**: SQLite3 (WAL mode with concurrent access and foreign keys enabled)
- **Frontend**: Vanilla JavaScript (ES6 Modules), CSS3, HTML5
- **Packaging**: Python Wheel (`.whl`), Conda environment launcher, PyInstaller standalone binaries, Inno Setup (Windows installer)

---

## Installation & Deployment

### Option 1: Conda / Virtual Environment via PyPI (Recommended)

EasyBio.Vibe IMS is distributed as a universal Python package on **PyPI**. It can be installed inside an isolated Conda or virtual environment and integrated directly into your operating system's application launcher.

```bash
# 1. Create a dedicated Python 3.11 environment
conda create -n easybiovibe python=3.11 -y

# 2. Activate the environment
conda activate easybiovibe

# 3. Install from PyPI (or via a downloaded .whl from GitHub Releases)
pip install easybiovibe-ims

# 4. Generate native OS desktop launcher / Start Menu shortcut
easybiovibe --install-shortcut
```

*For more details on launcher paths, port overrides, and maintenance, see the [Conda Deployment Guide](conda_install.md).*

### Option 2: Running from Source (Development)

```bash
# 1. Clone the repository
git clone https://github.com/shamshad-ather/EasyBioVibe-IMS.git
cd EasyBioVibe-IMS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch the application
python run.py
```

The application automatically discovers an available local port, starts the Flask server, and opens your default browser.

---

## Command Line Interface (CLI)

When installed via pip/wheel, the `easybiovibe` command is available directly in your activated environment:

| Command | Description |
|---|---|
| `easybiovibe` | Launches the server and opens the browser interface |
| `easybiovibe --install-shortcut` | Generates native OS launcher (.desktop / .lnk) and exits |
| `easybiovibe --port 5050` | Runs the server on a custom port |
| `easybiovibe --help` | Displays available command options |

---

## First-Time Setup Wizard

On the very first launch, the **Setup Wizard** guides you through initial configuration:
- **System Mode**: Single Lab or Centralized Facility.
- **Institution Details**: Lab Name, Lab Abbreviation, and Smart ID Prefix.
- **Administrator Account**: Set up primary credentials.
- **Security Questions**: Mandatory setup for offline password recovery.

---

## Building and Packaging

### Building Packages Locally
```bash
pip install build wheel
python -m build
```
The resulting `.whl` and `.tar.gz` packages will be placed in `dist/`.

### Automated Releases & PyPI Publishing via GitHub Actions
GitHub Actions (`.github/workflows/build.yml`) builds distribution packages, creates a GitHub Release with attached assets, and publishes to PyPI whenever a tag is pushed:

```bash
git tag v2026.11.06
git push origin v2026.11.06
```
See [`PACKAGING.md`](PACKAGING.md) for full packaging details and PyPI setup.

---

## License

EasyBio.Vibe IMS is software developed by Shamshad Ather for academic and institutional use.
