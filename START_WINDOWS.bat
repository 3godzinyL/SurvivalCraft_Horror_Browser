@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nie jest zainstalowany. Otworz po prostu index.html w przegladarce.
  pause
  start "" index.html
  exit /b
)
start "NightCraft Server" cmd /k node server.js
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:8177
