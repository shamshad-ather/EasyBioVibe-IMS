# EasyBioVibe-IMS 🧬

**Lab Inventory Management System**

EasyBioVibe-IMS is a lightweight, cross-platform Inventory Management System built for modern research laboratories. It provides a secure, offline-first local database to track materials, physical batches, and usage consumption across different departments, faculty, and research studies.

## ✨ Key Features

*   **Complete Inventory Tracking:** Manage a master catalogue of reagents, chemicals, kits, and consumables.
*   **Batch & Expiry Management:** Track individual procurement batches, LOT numbers, and receive low-stock/expiry alerts.
*   **Granular Usage Logs:** Record exact material consumption mapped directly to specific users, faculty (PIs), and research studies.
*   **Centralized Masters:** Maintain active records for Departments, Faculty, Studies, Users, Vendors, and Documents.
*   **Audit Trail:** A strict, automated history log that tracks every modification made within the system.
*   **Self-Contained Database:** Runs entirely locally via SQLite, ensuring data privacy and allowing for simple, one-click database backups and imports.

## 🚀 Installation

You do not need to install Python or any dependencies to run this application. Pre-compiled executables are automatically generated for Windows, macOS, and Linux.

1. Go to the [Releases](../../releases) page.
2. Download the installer for your operating system:
   * **Windows:** `EasyBioVibe-IMS-Windows-Installer.exe`
   * **macOS:** `EasyBioVibe-IMS.dmg`
   * **Linux:** `EasyBioVibe-IMS-linux.tar.gz`
3. Run the application. On the first launch, you will be prompted to set up your lab's branding and create the Head Admin account.

## 🛠️ Development & Building from Source

If you wish to contribute to the code or build the executables yourself, this project uses Python, Flask, HTML/CSS/JS, and PyInstaller.

Please refer to the [`packaging.md`](packaging.md) file for comprehensive instructions on setting up your environment, running the developer server, and compiling the standalone binaries.

---
*Vibed by Shamshad Ather using Gemini and Calude*
