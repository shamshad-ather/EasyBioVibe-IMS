# EasyBioVibe-IMS: Conda & Wheel Deployment Guide

This guide describes how to install and deploy **EasyBioVibe-IMS** as a Python wheel (`.whl`) within a dedicated, isolated Conda or Micromamba environment, while seamlessly integrating it as a native desktop application in your operating system's App Drawer or Start Menu.

---

## 1. Quickstart Workflow

Execute the following commands in your terminal or Conda prompt:

```bash
# 1. Create a dedicated Python 3.11 environment
conda create -n easybiovibe python=3.11 -y

# 2. Activate the environment
conda activate easybiovibe

# 3. Install the application wheel
pip install easybiovibe-ims-1.0.0-py3-none-any.whl

# 4. Generate native OS desktop launcher / Start Menu shortcut
easybiovibe --install-shortcut
```

*(If using `micromamba`, replace `conda` with `micromamba` in the commands above.)*

---

## 2. What `--install-shortcut` Does Under the Hood

The `--install-shortcut` command dynamically queries `sys.executable` to resolve the exact binary path of the active Conda/micromamba Python interpreter. This guarantees that your desktop shortcut always targets the isolated environment containing all application dependencies, avoiding conflicts with system Python.

### On Linux (Ubuntu, Linux Mint, Kubuntu, Debian, Fedora)
- **App Launcher**: Creates a standard FreeDesktop entry at `~/.local/share/applications/easybiovibe.desktop`.
- **Application Icon**: Copies the high-resolution packaged `assets/icon_256.png` to `~/.easybiovibe/icon.png`.
- **Desktop Categories**: Tagged under `Science` and `Office` so it appears in the appropriate app launcher categories.
- **Direct Execution**: The `Exec=` parameter executes the Conda environment's Python binary directly (`python -m app.run`), launching the web interface in your default browser.

### On Windows (Windows 10, Windows 11)
- **Start Menu Shortcut**: Generates a `.lnk` launcher inside `%APPDATA%\Microsoft\Windows\Start Menu\Programs\EasyBioVibe-IMS.lnk`.
- **Icon Binding**: Copies the packaged `icon.ico` to `%USERPROFILE%\.easybiovibe\icon.ico` and associates it with the shortcut.
- **Zero-Dependency Generation**: Uses an embedded Windows Scripting Host (VBScript/PowerShell) engine to build the `.lnk` file without requiring external C extensions or administrative elevation.

---

## 3. Launching EasyBioVibe-IMS

Once installed, you can launch the application in either of two ways:

1. **Native OS Launcher (Recommended)**:
   - **Linux**: Open your Application Menu / App Drawer and search for **EasyBioVibe-IMS**.
   - **Windows**: Open the Start Menu, search for **EasyBioVibe-IMS**, or pin it to your Start/Taskbar.
2. **Terminal / CLI**:
   ```bash
   conda activate easybiovibe
   easybiovibe
   ```

When started:
- The server automatically binds to a free local port (defaulting to dynamic discovery, or configurable via `EASYBIO_PORT`).
- Your default web browser opens automatically to the dashboard at `http://127.0.0.1:<port>`.
- A background heartbeat monitor periodically checks session activity. If idle or closed for 15 minutes, it automatically creates a database backup and cleanly shuts down the server.

---

## 4. Customizing Port Binding

If you wish to specify a fixed port rather than dynamic port allocation, use the `--port` option:

```bash
easybiovibe --port 5005
```

---

## 5. Data Persistence & Upgrades

- **Database Location**: The SQLite database and uploaded documents are stored in user space:
  - Linux: `~/.cache/easybiovibe/easybiovibe.db`
  - Windows: `%USERPROFILE%\.cache\easybiovibe\easybiovibe.db`
- **Upgrades**: Upgrading or reinstalling the `.whl` package will **never** overwrite or reset your laboratory inventory data or uploaded documents.
  ```bash
  conda activate easybiovibe
  pip install --upgrade easybiovibe-ims-<version>-py3-none-any.whl
  ```

---

## 6. Removing / Uninstalling

To uninstall the application and remove the desktop launchers:

```bash
# Activate environment
conda activate easybiovibe

# Uninstall package
pip uninstall easybiovibe-ims -y

# Remove desktop shortcuts
# Linux:
rm -f ~/.local/share/applications/easybiovibe.desktop
# Windows:
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\EasyBioVibe-IMS.lnk"
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\EasyBioVibe.lnk"

# Deactivate and delete Conda environment
conda deactivate
conda remove -n easybiovibe --all -y
```
