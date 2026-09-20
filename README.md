# EasyBio.Vibe IMS

EasyBio.Vibe is a robust, local-first Laboratory Inventory Management System (LIMS) designed for academic and research laboratories. It provides a secure, streamlined platform to manage inventory, track material consumption, maintain equipment compliance, and organize laboratory personnel and studies.

## Features

- **Inventory & Batch Tracking**: Manage material stock, expiration dates, and lot numbers. Real-time depletion alerts and low-stock indicators.
- **Equipment Management**: Track lab instruments, maintain service logs, and monitor calibration/maintenance schedules.
- **Smart Semantic IDs**: Auto-generated, human-readable IDs tailored to your institution (e.g., `MGMMCNERUL-USR001`).
- **Unified Personnel & Roles**: Flexible role-based access control (Admin vs. Standard Users) with a unified user hierarchy.
- **Study & Project Allocation**: Assign users to multiple overlapping studies to accurately attribute material consumption to specific research grants or activities.
- **Document Compliance**: Securely upload and link SOPs, SDSs, and compliance certificates directly to materials and equipment.
- **Native OS Backups**: Built-in folder picker for generating safe, point-in-time SQLite database backups to your local file system.
- **Beautiful UI**: Modern, dark-themed responsive interface.

## Tech Stack

- **Backend**: Python 3, Flask
- **Database**: SQLite3 (WAL mode for concurrent access)
- **Frontend**: Vanilla JavaScript (ES6 Modules), CSS3, HTML5
- **Packaging**: PyInstaller (Standalone executables for Linux and Windows)

## Installation

### Using Pre-built Binaries (Recommended)
Download the latest executable for your operating system from the Releases page.

**Windows**: Run the `.exe` installer or standalone executable.
**Linux**: Run `install.sh` from the downloaded `.tar.gz` archive, or execute the binary directly.

### Running from Source
1. Clone the repository.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the application:
   ```bash
   python3 run.py
   ```
The server will start on a dynamic local port and automatically open the UI in your default web browser.

## First-Time Setup Wizard

On the very first launch, you will be greeted by the **Setup Wizard**. Here you will define:
- **System Mode**: Single Lab or Centralized Facility.
- **Institution Details**: Lab Name, Abbreviation, and Smart ID Prefix.
- **Head Admin Account**: Create the primary administrator account.
- **Security Questions**: Mandatory setup for offline password recovery.

## Development & Building

To package the application into a standalone executable, refer to the `PACKAGING.md` guide. Continuous Integration via GitHub Actions (`.github/workflows/build.yml`) is already configured to automatically build and package artifacts for Windows and Ubuntu on every push.

## License

EasyBio.Vibe is software developed by Shamshad Ather for academic and institutional use.
