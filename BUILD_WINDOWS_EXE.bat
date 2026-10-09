@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title NightCraft V26 - BUDOWANIE EXE
where node.exe >nul 2>nul
if errorlevel 1 goto :NONODE
node -e "if(+process.versions.node.split('.')[0]<20)process.exit(1)"
if errorlevel 1 goto :NONODE
where npm.cmd >nul 2>nul
if errorlevel 1 goto :NONODE
echo.
echo ===== NIGHTCRAFT V26 - APLIKACJA WINDOWS =====
echo Node uruchomiony z:
where node.exe
echo.
echo ===== INSTALACJA ELECTRON I BUILDER =====
call npm install --no-audit --no-fund
if errorlevel 1 goto :INSTALL_FAILED
echo.
echo ===== TESTY KODU =====
call npm run check
if errorlevel 1 goto :TEST_FAILED
echo.
echo ===== BUDOWANIE POJEDYNCZEGO EXE =====
call npm run desktop:win
if errorlevel 1 goto :BUILD_FAILED
echo.
echo SUKCES: gotowy program w folderze dist-desktop\
explorer "%CD%\dist-desktop"
pause
exit /b 0
:NONODE
echo ERROR: Zainstaluj Node.js 20+ z https://nodejs.org/
pause
exit /b 1
:INSTALL_FAILED
echo.
echo ERROR: Instalacja zaleznosci npm nie powiodla sie.
pause
exit /b 1
:TEST_FAILED
echo.
echo ERROR: Nie przeszly testy. Proces BUDOWANIA EXE jeszcze sie nie rozpoczal.
echo Sprawdz blad bezposrednio nad tym komunikatem.
pause
exit /b 1
:BUILD_FAILED
echo.
echo ERROR: Testy przeszly, lecz electron-builder nie utworzyl EXE.
echo Sprawdz komunikat electron-builder nad tym komunikatem.
pause
exit /b 1
