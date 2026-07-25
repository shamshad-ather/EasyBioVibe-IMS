; EasyBioVibe-IMS Windows installer
; Built with Inno Setup (preinstalled on GitHub-hosted windows-latest runners).
; Per-user install under LocalAppData -- no admin rights required, which
; matters on shared/institutional lab PCs where staff may not have admin.

#define MyAppName "EasyBioVibe-IMS"
#define MyAppVersion "2026.07.03"
#define MyAppExeName "EasyBioVibe-IMS.exe"

[Setup]
AppId={{6E6C0D2F-6B7B-4E4C-9C4B-EASYBIOVIBE01}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=EasyBioVibe-IMS-Setup-{#MyAppVersion}
SetupIconFile=..\..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
Source: "..\..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName} now"; Flags: nowait postinstall skipifsilent