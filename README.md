# EasyBio.Vibe IMS

**EasyBio.Vibe IMS** is a modern, local-first Laboratory Information and Inventory Management System (LIMS) designed for molecular biology, RT-qPCR, and academic research laboratories. It provides a secure, streamlined platform to manage reagents and consumables, maintain equipment compliance, track study allocations, and record material consumption with full audit trails.

---

## Key Features

- **Inventory & Batch Tracking**: Manage material stock, expiration dates, open-container dates, and lot numbers. Real-time depletion alerts and low-stock thresholds.
- **Studies & Project Allocation**: Centralized management of research, diagnostic, and QC activities. Assign studies to Principal Investigators (PIs) and Departments with automatic cross-mapping.
- **Equipment Management**: Track lab instruments, maintain service and calibration event logs, and record locations.
- **Cross-Platform Native Desktop Integration**: Native OS launcher generator creating Start Menu shortcuts on Windows (`.lnk`) and App Drawer entries on Linux (`.desktop`), directly bound to isolated Conda environments.
- **Smart Semantic IDs**: Auto-generated, human-readable IDs tailored to your institution (e.g., `MGMMCNERUL-CIRL-INV000001`, `MGMMCNERUL-CIRL-STU001`) with built-in legacy ID migration.
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

### Option 1: Conda Environment via Python Wheel (Recommended)

EasyBio.Vibe IMS can be installed inside an isolated Conda or Micromamba environment and integrated directly into your operating system's application launcher.

```bash
# 1. Create a dedicated Python 3.11 environment
conda create -n easybiovibe python=3.11 -y

# 2. Activate the environment
conda activate easybiovibe

# 3. Install the wheel package
pip install easybiovibe-ims-1.0.0-py3-none-any.whl

# 4. Generate native OS desktop launcher / Start Menu shortcut
easybiovibe --install-shortcut
```

*For more details on launcher paths, port overrides, and maintenance, see the [Conda Deployment Guide](conda_install.md).*

### Option 2: Pre-built Standalone Binaries

Download pre-compiled binaries from the GitHub [Releases](https://github.com/shamshad-ather/EasyBioVibe-IMS/releases) page:

- **Windows**: Run `EasyBioVibe-IMS-Setup-<version>.exe` to install per-user (no administrative permissions required). Adds a Start Menu shortcut and an uninstaller.
- **Linux**: Extract `EasyBio.Vibe-<version>-linux-installer.tar.gz` and run:
  ```bash
  ./install.sh
  ```
  This installs the application to `~/.local/bin` and adds an icon to your desktop Application Menu.
- **macOS**: Mount `EasyBio.Vibe-<version>-macos.dmg` and copy the application bundle to your Applications folder.

### Option 3: Running from Source

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

### Building the Wheel Package
```bash
pip install build wheel
python -m build --wheel
```
The resulting `.whl` package will be placed in `dist/`.

### Building Standalone Binaries locally
Refer to [`PACKAGING.md`](PACKAGING.md) for full instructions on building with PyInstaller on Linux, Windows, and macOS.

### Automated Releases via GitHub Actions
GitHub Actions (`.github/workflows/build.yml`) builds binaries and attaches them to a new release whenever a tag is pushed:

```bash
git tag v2026.11.06
git push origin v2026.11.06
```

---

## License

EasyBio.Vibe IMS is software developed by Shamshad Ather for academic and institutional use.
