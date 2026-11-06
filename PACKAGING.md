# Packaging & Distribution: EasyBioVibe-IMS

EasyBioVibe-IMS is distributed as a universal Python wheel (`.whl`) and source distribution (`sdist`), published directly to **PyPI** and attached to **GitHub Releases**.

Instead of bundling heavy platform-specific binaries using PyInstaller and Inno Setup, EasyBioVibe-IMS installs cleanly into an isolated Conda or virtual environment on any operating system (Windows, Linux, macOS). It provides native desktop integration through its built-in cross-platform launcher generator (`easybiovibe --install-shortcut`).

---

## 1. End-User Installation Workflow

End-users install directly from PyPI (or via a downloaded wheel):

```bash
# 1. Create a dedicated Conda environment
conda create -n easybiovibe python=3.11 -y
conda activate easybiovibe

# 2. Install from PyPI
pip install easybiovibe-ims

# 3. Generate native Start Menu / App Drawer desktop icon
easybiovibe --install-shortcut
```

### Native Desktop Integration
- **Windows**: Dynamically reads `sys.executable` and creates an application shortcut (`.lnk`) in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\EasyBioVibe-IMS.lnk` pointing to the isolated Conda executable, with the application icon copied to `~/.easybiovibe/icon.ico`.
- **Linux**: Dynamically reads `sys.executable` and generates a FreeDesktop `.desktop` entry in `~/.local/share/applications/easybiovibe.desktop`, with the high-resolution icon copied to `~/.easybiovibe/icon.png`.

---

## 2. Building the Package Locally

Ensure you have `build` and `wheel` installed:

```bash
pip install build wheel
```

Build the distribution packages:

```bash
python -m build
```

This creates:
- `dist/easybiovibe_ims-<version>-py3-none-any.whl` (Universal Wheel)
- `dist/easybiovibe_ims-<version>.tar.gz` (Source Distribution)

To test the built wheel locally in a clean environment:

```bash
pip install dist/easybiovibe_ims-*.whl
easybiovibe --install-shortcut
```
