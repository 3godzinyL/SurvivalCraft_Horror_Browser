@echo off
setlocal EnableExtensions
title NightCraft - diagnostics
cd /d "%~dp0"
echo ========= NightCraft V15.1 diagnostics =========
echo.
echo Folder: %CD%
echo.
echo Node.js:
where node.exe 2>nul
node --version 2>nul
if errorlevel 1 echo Node.js not found or not runnable.
echo.
echo PowerShell:
where powershell.exe 2>nul
powershell.exe -NoProfile -Command "$PSVersionTable.PSVersion.ToString()" 2>nul
echo.
echo Required files:
for %%F in ("index.html" "server.cjs" "src\main.js" "tools\serve-windows.ps1" "tools\open-browser.ps1") do (
  if exist "%%~F" (echo [OK] %%~F) else (echo [MISSING] %%~F)
)
echo.
echo Checking port 8177:
where powershell.exe >nul 2>nul
if not errorlevel 1 powershell.exe -NoProfile -Command "try { $c=[Net.Sockets.TcpClient]::new('127.0.0.1',8177); Write-Host 'PORT OCCUPIED / SERVER PRESENT'; $c.Close() } catch { Write-Host 'PORT FREE / SERVER NOT RUNNING' }"
echo.
echo Log locations:
echo %CD%\logs\launcher.log
echo %CD%\logs\server.log
echo.
echo Press any key to close.
pause >nul
