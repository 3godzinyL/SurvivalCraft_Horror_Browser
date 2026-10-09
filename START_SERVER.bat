@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title NightCraft V24 - HOST SERVER + NGROK
if not exist "multiplayer\server.cjs" goto :MISSING
where node.exe >nul 2>nul
if errorlevel 1 goto :NO_NODE
set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto :NO_NODE
if %NODE_MAJOR% LSS 20 goto :NO_NODE

set "PORT=8787"
set "HOST=0.0.0.0"
if not exist "logs" mkdir "logs" >nul 2>nul

echo.
echo ====================================================
echo    NIGHTCRAFT V24 - HOST WSPOLNEGO SWIATA
 echo ====================================================
echo.
echo   Serwer multiplayer: http://127.0.0.1:8787
 echo   Tunel NGROK:         ngrok http 8787
 echo.
echo   1. Potrzebujesz konta/tokena ngrok na komputerze hosta.
echo   2. Jesli nie uruchomisz tunelu automatycznie, wykonaj:
echo      ngrok http 8787
 echo   3. Skopiuj adres HTTPS (np. https://abc.ngrok-free.app).
echo   4. W grze: START ONLINE i wklej ten adres.
echo.
where ngrok.exe >nul 2>nul
if errorlevel 1 goto :NO_NGROK
set "NGROK_AUTO="
set /p "NGROK_AUTO=Uruchomic ngrok http 8787 w osobnym oknie? [T/n]: "
if /I "%NGROK_AUTO%"=="N" goto :ASK_URL
start "NightCraft NGROK HTTP" cmd /k "ngrok http 8787"
goto :ASK_URL
:NO_NGROK
echo [INFO] ngrok nie jest zainstalowany lub nie jest w PATH.
echo [INFO] Pobierz z https://ngrok.com/download , skonfiguruj authtoken
 echo [INFO] i uruchom: ngrok http 8787
:ASK_URL
echo.
set "NC_PUBLIC_URL="
set /p "NC_PUBLIC_URL=Wklej adres HTTPS ngrok (Enter = podasz go graczom pozniej): "
echo.
if defined NC_PUBLIC_URL powershell.exe -NoProfile -Command "Write-Output ('[LINK] Adres hosta: '+$env:NC_PUBLIC_URL)"
echo [INFO] Wszyscy po START ONLINE polacza sie z jednym swiatem.
echo [INFO] Zmiany blokow zapisywane sa w multiplayer\room-data\
echo [INFO] Nie zamykaj TEGO OKNA, dopoki graja inni.
echo [INFO] Zatrzymanie serwera: Ctrl+C.
echo.
node "multiplayer\server.cjs"
set "EXIT_CODE=%errorlevel%"
echo.
echo [STOP] Serwer zatrzymal sie. Exit code: %EXIT_CODE%
echo [INFO] Powiadomienia i bledy serwera byly wypisywane powyzej.
echo [INFO] Jezeli widziales bledy powyzej, skopiuj je do raportu.
pause
exit /b %EXIT_CODE%
:MISSING
echo [ERROR] Wypakuj CALY ZIP, brakuje multiplayer\server.cjs
pause
exit /b 1
:NO_NODE
echo [ERROR] Wymagany Node.js 20 lub nowszy: https://nodejs.org/
pause
exit /b 1
