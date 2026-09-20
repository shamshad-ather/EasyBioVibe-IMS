# Packaging EasyBioVibe-IMS as a desktop app

`run.py` is the application entry point: when packaged or run locally, it starts the Flask server, automatically finds an available local port, opens your default browser to it, and manages application lifecycle.

There is no single binary that runs on Windows, macOS, and Linux — each OS needs its own build (PyInstaller bundles a platform-specific interpreter). What's automated instead is the **pipeline**: `.github/workflows/build.yml` builds all three from this repository whenever you push a tag like `v2026.09.03`, and attaches all files to a GitHub Release.

## Building locally

### Linux

```bash
pip install -r requirements.txt
pyinstaller --noconfirm --onefile --windowed \
    --name "EasyBioVibe-IMS" \
    --icon "assets/icon_256.png" \
    --add-data "app/templates:templates" \
    --add-data "app/static:static" \
    --add-data "VERSION.md:." \
    --hidden-import "app.routes.auth" \
    --hidden-import "app.routes.system" \
    --hidden-import "app.routes.masters" \
    --hidden-import "app.routes.inventory" \
    --hidden-import "app.routes.transactions" \
    --hidden-import "app.routes.equipment" \
    run.py
```

Result: `dist/EasyBioVibe-IMS`, a single executable, no Python required on the target machine. To install it into the app menu for the current user (no sudo):

```bash
cp dist/EasyBioVibe-IMS packaging/linux/
cd packaging/linux && ./install.sh
```

### Windows (run on Windows or via GitHub Actions)

```powershell
pyinstaller --noconfirm --onefile --windowed `
    --name "EasyBioVibe-IMS" `
    --icon "assets\icon.ico" `
    --add-data "app/templates;templates" `
    --add-data "app/static;static" `
    --add-data "VERSION.md;." `
    --hidden-import "app.routes.auth" `
    --hidden-import "app.routes.system" `
    --hidden-import "app.routes.masters" `
    --hidden-import "app.routes.inventory" `
    --hidden-import "app.routes.transactions" `
    --hidden-import "app.routes.equipment" `
    run.py
```

Then compile `packaging/windows/installer.iss` with Inno Setup (free,
[https://jrsoftware.org/isinfo.php](https://jrsoftware.org/isinfo.php)) to get a proper `EasyBioVibe-IMS-Setup-2026.07.03.exe`
— installs per-user (no admin rights needed, useful on institutional PCs),
adds Start Menu + optional Desktop shortcut, includes an uninstaller.

### macOS (needs to run on a Mac, or via the GitHub Action)

Same command as Linux but add `--windowed`; PyInstaller produces
`dist/EasyBioVibe-IMS.app` directly. Wrap it in a `.dmg` for distribution:

```bash
hdiutil create -volname "EasyBioVibe-IMS" -srcfolder dist -ov -format UDZO EasyBioVibe-IMS.dmg

```

## Automated builds (recommended, since this is going open-source)

Push a version tag and GitHub Actions builds all three and publishes a
Release with all three files attached:

```bash
git tag v2026.07.03
git push origin v2026.07.03

```

You can also trigger it manually from the Actions tab without tagging, to
just check the builds still pass — those runs upload artifacts but don't
publish a Release.

## Notes

* The database lives dynamically inside a hidden cache folder (`~/.cache/easybiovibe/easybiovibe.db`) regardless of where the app is installed, so reinstalling/upgrading never touches your data.
* `run.py` dynamically binds to an available port and launches your default web browser automatically upon startup.