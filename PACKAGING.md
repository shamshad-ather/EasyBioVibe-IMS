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
pip install dist/easybiovibe_ims-1.0.0-py3-none-any.whl
easybiovibe --install-shortcut
```

---

## 3. Automated GitHub Actions Pipeline

Whenever a new version tag (e.g. `v2026.11.06`) is pushed, [`.github/workflows/build.yml`](.github/workflows/build.yml) automatically:
1. Builds the source distribution and universal wheel package.
2. Creates a GitHub Release with release notes and attaches the wheel and sdist files.
3. Automatically publishes the package to **PyPI** using PyPI Trusted Publishing.

To release a new version:

```bash
# 1. Update VERSION.md (e.g., v2026.11.06)
# 2. Commit and tag:
git commit -am "release: v2026.11.06"
git tag v2026.11.06
git push origin v2026.11.06
```

---

## 4. Setting up PyPI Trusted Publishing

PyPI supports **Trusted Publishing (OIDC)**, which eliminates the need to manually manage or rotate API tokens in GitHub secrets:

1. Log in to [PyPI](https://pypi.org/).
2. Go to **Account Settings** $\to$ **Publishing** $\to$ **Add a new publisher with GitHub**.
3. Fill in:
   - **PyPI Project Name**: `easybiovibe-ims`
   - **Owner / Organization**: `shamshad-ather`
   - **Repository Name**: `EasyBioVibe-IMS`
   - **Workflow name**: `build.yml`
4. That's it! GitHub Actions will securely authenticate with PyPI via OIDC tokens and publish each release automatically.
