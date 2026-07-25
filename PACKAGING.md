# Packaging EasyBioVibe-IMS as a desktop app

`launcher.py` is the actual entry point once packaged: it starts the Flask
server in the background, opens your default browser to it, and shows a
system-tray icon (Open / Quit) so it behaves like a normal installed app
instead of a terminal window you babysit. `app.py` is unchanged in behavior
— it now just resolves `templates/`/`static/` correctly whether run from
source or from inside a frozen executable.

There is no single binary that runs on Windows, macOS, and Linux — each OS
needs its own build (PyInstaller bundles a platform-specific interpreter,
same as every other compiled desktop app). What's automated instead is the
**pipeline**: `.github/workflows/build.yml` builds all three from this one
repo whenever you push a tag like `v2026.07.03`, and attaches all three files to
a single GitHub Release. Anyone downloading just grabs the file matching
their OS.

## Building locally

### Linux (what I built and tested here)

```bash
pip install -r requirements.txt
python assets/make_icon.py   # only needed if you change the icon design
pyinstaller --onefile --name EasyBioVibe-IMS \
    --icon assets/icon.ico \
    --add-data "templates:templates" \
    --add-data "assets:assets" \
    --add-data "static:static" \
    --hidden-import flask_bcrypt \
    launcher.py

```

Result: `dist/EasyBioVibe-IMS`, a single ~47MB executable, no Python required on
the target machine. To install it into the app menu for the current user
(no sudo):

```bash
cp dist/EasyBioVibe-IMS packaging/linux/
cd packaging/linux && ./install.sh

```

### Windows (needs to run on Windows, or via the GitHub Action)

Same PyInstaller command but with `;` instead of `:` in `--add-data`, and
add `--windowed` (no console window):

```powershell
pyinstaller --onefile --windowed --name EasyBioVibe-IMS `
    --icon assets\icon.ico `
    --add-data "templates;templates" `
    --add-data "assets;assets" `
    --add-data "static;static" `
    --hidden-import flask_bcrypt `
    launcher.py

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

* The database lives dynamically inside a hidden cache folder (`~/.cache/easybiovibe/easybiovibe.db` on Linux/macOS, or the equivalent LocalAppData path on Windows) regardless of where the app is installed, so reinstalling/upgrading never touches your data.
* `launcher.py` checks whether a server is already running on port 5000
before starting a new one, so double-clicking the icon twice just opens
another browser tab instead of a second server.
* If the system tray isn't available (some minimal Linux window managers),
it falls back to a plain console — press Ctrl+C there to quit.