#!/usr/bin/env bash
# Removes EasyBioVibe-IMS (the app only -- your database in ~/.cache/easybiovibe/easybiovibe.db is left untouched).
set -e

rm -f "$HOME/.local/bin/easybiovibe-ims"
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/easybiovibe-ims.png"
rm -f "$HOME/.local/share/applications/easybiovibe-ims.desktop"

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "EasyBioVibe-IMS removed. Your database at ~/.cache/easybiovibe/easybiovibe.db was left in place."