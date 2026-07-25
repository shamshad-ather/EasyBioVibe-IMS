#!/usr/bin/env bash
# Installs EasyBioVibe-IMS for the current user (no sudo/root needed).
# Run this from inside the extracted release folder:
#   ./install.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_SRC="$SCRIPT_DIR/EasyBioVibe-IMS"
ICON_SRC="$SCRIPT_DIR/../../assets/icon_256.png"
DESKTOP_SRC="$SCRIPT_DIR/easybiovibe-ims.desktop"

BIN_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
APPS_DIR="$HOME/.local/share/applications"

mkdir -p "$BIN_DIR" "$ICON_DIR" "$APPS_DIR"

cp "$BIN_SRC" "$BIN_DIR/easybiovibe-ims"
chmod +x "$BIN_DIR/easybiovibe-ims"
cp "$ICON_SRC" "$ICON_DIR/easybiovibe-ims.png"
sed "s|Exec=REPLACED_AT_INSTALL_TIME|Exec=$BIN_DIR/easybiovibe-ims|" "$DESKTOP_SRC" > "$APPS_DIR/easybiovibe-ims.desktop"

update-desktop-database "$APPS_DIR" 2>/dev/null || true
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "EasyBioVibe-IMS installed."
echo "Find it in your application menu, or run: $BIN_DIR/easybiovibe-ims"
echo "(Make sure $BIN_DIR is on your PATH to launch it by name from a terminal.)"