@echo off
setlocal
set "NODE_ENV=production"
set "APP_HOST=0.0.0.0"
set "APP_PORT=3000"
set "DATA_DIR=%LOCALAPPDATA%\ExecutiveOfficePortal\data"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
cd /d "%~dp0"
echo Executive Office Portal central server is starting on port %APP_PORT%.
echo Keep this window open while office computers use the portal.
echo To stop the server, close this window.
"%~dp0runtime\node.exe" "%~dp0dist-server\server.js"
pause
