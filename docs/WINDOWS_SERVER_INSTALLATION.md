# Windows LAN Server Setup

The Windows installer runs one central server and keeps the SQLite database on that computer. Other office computers use a browser to connect to the same server; they do not install a separate copy of the database.

## Build and download the installer

The `Windows Server Installer` GitHub Actions workflow builds `Executive-Office-Portal-Setup.exe`. Download it from the workflow run's **Artifacts** section. The artifact is retained for 14 days.

## Install the central server

1. Choose one Windows 10/11 x64 computer that will stay on while staff use the portal.
2. Run `Executive-Office-Portal-Setup.exe`. It installs for the current Windows account and does not require administrator permissions.
3. Start **Executive Office Portal Server** from the Start menu or desktop shortcut. Keep the command window open while staff use the portal. Closing it stops the server.
4. On first start, keep the command window private and follow the app's first-run credential instructions. Change initial passwords before staff use the system.
5. In Windows Defender Firewall, allow inbound TCP port 3000 on **Private networks only**. Do not expose this port to the public internet.
6. On the server computer, run `ipconfig` and note its IPv4 address. For example, if it is `192.168.1.25`, open `http://192.168.1.25:3000` on each office computer's browser.

Reserve the server computer's IP address in the office router so the link stays stable. Give each person a separate account and role. The chairman account can be used on the manager's computer; the manager signs in with their own credentials. The app's existing role permissions determine which records each account can view.

## Data and backups

The database is stored under the Windows account that starts the server, at `%LOCALAPPDATA%\ExecutiveOfficePortal\data`. Only that account needs local file access; browser clients access the application over HTTP and do not access the database files. Back up this directory using the project's backup procedure before installing updates or moving to another computer. Uninstalling the program does not remove this data directory.

Close the server command window before installing an update. The installer does not delete the database.

## Security scope

This installer is intended for a trusted private office LAN. The app currently lacks MFA and has not passed an independent security review or penetration test. Do not use real confidential or sensitive records until the organization's IT/security team approves the deployment. HTTP traffic on the LAN is not encrypted; use a properly configured HTTPS reverse proxy if the network requires transport encryption.
