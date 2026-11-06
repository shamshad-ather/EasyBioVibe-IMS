import os
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path

def find_packaged_icon(icon_name: str) -> Path | None:
    """
    Search for a packaged icon file across source tree, package installation,
    and system prefix locations.
    """
    candidate_paths = [
        # In development / git checkout (assets/ at repo root)
        Path(__file__).resolve().parent.parent / "assets" / icon_name,
        # Inside app package if bundled
        Path(__file__).resolve().parent / "assets" / icon_name,
        # Installed package root / site-packages
        Path(sys.prefix) / "assets" / icon_name,
        Path(sys.prefix) / "share" / "easybiovibe" / "assets" / icon_name,
        Path(sys.prefix) / "Lib" / "site-packages" / "assets" / icon_name,
        # Current working directory fallback
        Path.cwd() / "assets" / icon_name,
        # Already copied to user config dir
        Path.home() / ".easybiovibe" / icon_name,
    ]

    # Also search sys.path entries
    for p in sys.path:
        candidate_paths.append(Path(p) / "assets" / icon_name)
        candidate_paths.append(Path(p) / "easybiovibe" / "assets" / icon_name)

    for candidate in candidate_paths:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()

    return None

def copy_icon_to_user_dir(src_filename: str, dst_filename: str) -> Path:
    """
    Copy a packaged icon to ~/.easybiovibe/<dst_filename> to provide a stable,
    persistent location for OS launchers.
    """
    user_dir = Path.home() / ".easybiovibe"
    user_dir.mkdir(parents=True, exist_ok=True)
    dst_path = user_dir / dst_filename

    src_path = find_packaged_icon(src_filename)
    if src_path and src_path.exists():
        try:
            shutil.copyfile(src_path, dst_path)
        except Exception as e:
            print(f"[WARNING] Could not copy icon from {src_path} to {dst_path}: {e}")

    return dst_path

def create_linux_shortcut(desktop_file_path: Path | str | None = None,
                          icon_dest_path: Path | str | None = None) -> Path:
    """
    Generate a FreeDesktop .desktop entry in ~/.local/share/applications/easybiovibe.desktop.
    The Exec= line points directly to the active Conda/micromamba Python binary (sys.executable).
    The Icon= line points to ~/.easybiovibe/icon.png (copied from icon_256.png).
    """
    # 1. Copy icon_256.png to ~/.easybiovibe/icon.png
    if icon_dest_path is None:
        icon_path = copy_icon_to_user_dir("icon_256.png", "icon.png")
    else:
        icon_path = Path(icon_dest_path)
        icon_path.parent.mkdir(parents=True, exist_ok=True)
        src = find_packaged_icon("icon_256.png")
        if src and src.exists():
            shutil.copyfile(src, icon_path)

    # 2. Prepare target .desktop file path
    if desktop_file_path is None:
        apps_dir = Path.home() / ".local" / "share" / "applications"
        apps_dir.mkdir(parents=True, exist_ok=True)
        target_desktop = apps_dir / "easybiovibe.desktop"
    else:
        target_desktop = Path(desktop_file_path)
        target_desktop.parent.mkdir(parents=True, exist_ok=True)

    # 3. Read sys.executable to bind directly to the Conda Python binary
    python_exe = sys.executable
    exec_target = f'"{python_exe}"' if ' ' in python_exe else python_exe
    exec_command = f"{exec_target} -m app.run"

    desktop_content = f"""[Desktop Entry]
Type=Application
Name=EasyBioVibe-IMS
GenericName=Laboratory Information Management System
Comment=Inventory management for molecular biology / RT-qPCR labs
Exec={exec_command}
Icon={icon_path.as_posix()}
Terminal=false
Categories=Science;Office;
StartupNotify=true
"""

    with open(target_desktop, "w", encoding="utf-8") as f:
        f.write(desktop_content)

    # Set executable permissions (0755)
    try:
        target_desktop.chmod(0o755)
    except Exception:
        pass

    # Attempt to update desktop database if utility exists
    try:
        subprocess.run(["update-desktop-database", str(target_desktop.parent)],
                       capture_output=True, check=False)
    except Exception:
        pass

    return target_desktop

def create_windows_shortcut(programs_dir: Path | str | None = None,
                            icon_dest_path: Path | str | None = None) -> Path:
    """
    Generate a Windows .lnk shortcut in the Start Menu Programs folder
    (%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs) pointing to the Conda executable.
    Uses an embedded VBScript via cscript.exe (with PowerShell fallback).
    """
    # 1. Copy icon.ico to ~/.easybiovibe/icon.ico
    if icon_dest_path is None:
        icon_path = copy_icon_to_user_dir("icon.ico", "icon.ico")
        # Also copy icon_256.png for completeness
        copy_icon_to_user_dir("icon_256.png", "icon.png")
    else:
        icon_path = Path(icon_dest_path)
        icon_path.parent.mkdir(parents=True, exist_ok=True)
        src = find_packaged_icon("icon.ico")
        if src and src.exists():
            shutil.copyfile(src, icon_path)

    # 2. Determine Start Menu Programs directory
    if programs_dir is None:
        appdata = os.environ.get("APPDATA")
        if not appdata:
            appdata = str(Path.home() / "AppData" / "Roaming")
        target_programs_dir = Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
    else:
        target_programs_dir = Path(programs_dir)

    target_programs_dir.mkdir(parents=True, exist_ok=True)

    shortcut_path = target_programs_dir / "EasyBioVibe-IMS.lnk"
    alt_shortcut_path = target_programs_dir / "EasyBioVibe.lnk"

    # 3. Dynamic target pointing to Conda Python binary
    python_exe = sys.executable
    arguments = "-m app.run"
    working_dir = os.path.dirname(python_exe)
    icon_loc = f"{icon_path.resolve()},0" if icon_path.exists() else f"{python_exe},0"

    # 4. Embedded VBScript execution via cscript.exe
    vbs_content = f'''Set ws = CreateObject("WScript.Shell")
Set sc = ws.CreateShortcut("{shortcut_path}")
sc.TargetPath = "{python_exe}"
sc.Arguments = "{arguments}"
sc.WorkingDirectory = "{working_dir}"
sc.IconLocation = "{icon_loc}"
sc.Description = "EasyBioVibe-IMS Laboratory Management System"
sc.Save
'''

    temp_vbs = None
    success = False
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".vbs", delete=False, encoding="utf-8") as f:
            f.write(vbs_content)
            temp_vbs = f.name

        res = subprocess.run(["cscript", "//nologo", temp_vbs], capture_output=True, text=True, check=True)
        if shortcut_path.exists():
            success = True
    except Exception as e:
        # Fallback to PowerShell
        try:
            ps_cmd = (
                f'$ws = New-Object -ComObject WScript.Shell; '
                f'$sc = $ws.CreateShortcut("{shortcut_path}"); '
                f'$sc.TargetPath = "{python_exe}"; '
                f'$sc.Arguments = "{arguments}"; '
                f'$sc.WorkingDirectory = "{working_dir}"; '
                f'$sc.IconLocation = "{icon_loc}"; '
                f'$sc.Description = "EasyBioVibe-IMS Laboratory Management System"; '
                f'$sc.Save()'
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd],
                           capture_output=True, text=True, check=True)
            if shortcut_path.exists():
                success = True
        except Exception as ps_err:
            raise RuntimeError(f"Failed to create Windows shortcut via VBS and PowerShell: {e} / {ps_err}")
    finally:
        if temp_vbs and os.path.exists(temp_vbs):
            try:
                os.remove(temp_vbs)
            except Exception:
                pass

    # Create alias shortcut EasyBioVibe.lnk as well
    if shortcut_path.exists():
        try:
            shutil.copyfile(shortcut_path, alt_shortcut_path)
        except Exception:
            pass

    return shortcut_path

def create_shortcut() -> Path:
    """
    Main dispatch function: Detect the host OS and install the appropriate native launcher.
    Returns the Path to the created launcher.
    """
    if sys.platform.startswith("win"):
        return create_windows_shortcut()
    elif sys.platform.startswith("linux"):
        return create_linux_shortcut()
    elif sys.platform.startswith("darwin"):
        # On macOS, generate a launcher script / desktop entry
        return create_linux_shortcut()
    else:
        return create_linux_shortcut()

# Aliases for flexible API integration
install_shortcut = create_shortcut
generate_shortcut = create_shortcut

if __name__ == "__main__":
    path = create_shortcut()
    print(f"[SUCCESS] Native launcher created at: {path}")
