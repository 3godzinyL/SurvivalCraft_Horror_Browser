@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title NightCraft V25 - DESKTOP DEV
where node.exe >nul 2>nul
if errorlevel 1 goto :NONODE
if not exist "node_modules\electron\dist\electron.exe" (
 echo Instalacja Electron... potrzeba Internetu.
 call npm install --no-audit --no-fund
 if errorlevel 1 goto :FAILED
)
call npm run desktop
if errorlevel 1 goto :FAILED
exit /b 0
:NONODE
echo Wymagany Node.js 20+ https://nodejs.org/
pause
exit /b 1
:FAILED
echo Nie mozna uruchomic Electron. Sprawdz bledy powyzej.
pause
exit /b 1
