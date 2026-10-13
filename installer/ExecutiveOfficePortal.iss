#define ProductName "Executive Office Portal"
#define ProductVersion "1.0.0"
#define PayloadDir "payload"

[Setup]
AppId={{4F0929DB-A7FC-4A58-8564-F43C1FBB3B3B}
AppName={#ProductName}
AppVersion={#ProductVersion}
AppPublisher=Executive Office Portal
DefaultDirName={localappdata}\Programs\ExecutiveOfficePortal
DefaultGroupName={#ProductName}
PrivilegesRequired=lowest
OutputDir=..\release
OutputBaseFilename=Executive-Office-Portal-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\runtime\node.exe
CloseApplications=yes
RestartApplications=no
Uninstallable=yes
ChangesEnvironment=no

[Files]
Source: "{#PayloadDir}\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "{#PayloadDir}\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\start-server.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\dist-server\*"; DestDir: "{app}\dist-server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Start Executive Office Portal Server"; Filename: "{cmd}"; Parameters: "/k """"{app}\start-server.cmd"""""; WorkingDir: "{app}"
Name: "{userdesktop}\Start Executive Office Portal Server"; Filename: "{cmd}"; Parameters: "/k """"{app}\start-server.cmd"""""; WorkingDir: "{app}"
