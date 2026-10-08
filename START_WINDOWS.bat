@echo off
setlocal EnableExtensions DisableDelayedExpansion
title NightCraft V15.1 - local game server

rem Keep the actual server in THIS console. Do not detach it with START/CMD /K.
cd /d "%~dp0" 2>nul
if errorlevel 1 goto :BAD_DIRECTORY

if not exist "index.html" goto :NOT_EXTRACTED
if not exist "server.cjs" goto :NOT_EXTRACTED
if not exist "src\main.js" goto :NOT_EXTRACTED
if not exist "tools\serve-windows.ps1" goto :NOT_EXTRACTED

set "NC_PORT=8177"
if defined PORT set "NC_PORT=%PORT%"
if not exist "logs" mkdir "logs" >nul 2>nul
>>"logs\launcher.log" echo [%date% %time%] Launcher started in %CD%

echo.
echo ==========================================================
echo   NIGHTCRAFT V15.1 - LOCAL GAME SERVER
echo ==========================================================
echo   Game folder: %CD%
echo   Address:     http://127.0.0.1:%NC_PORT%/
echo   This window MUST stay open while you play.
echo   You do not need administrator rights.
echo.

where node.exe >nul 2>nul
if errorlevel 1 goto :USE_POWERSHELL

set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto :USE_POWERSHELL
if %NODE_MAJOR% LSS 20 goto :USE_POWERSHELL

echo [OK] Node.js detected: version %NODE_MAJOR%.
echo [INFO] Starting Node HTTP server. Stop with Ctrl+C.
>>"logs\launcher.log" echo [%date% %time%] Using Node.js major %NODE_MAJOR%.
call :OPEN_BROWSER
node "server.cjs"
set "NC_EXIT=%errorlevel%"
if "%NC_EXIT%"=="0" goto :STOPPED

echo.
echo [ERROR] Node server exited with code %NC_EXIT%.
>>"logs\launcher.log" echo [%date% %time%] Node server exit code %NC_EXIT%.
echo [INFO] Trying the built-in Windows PowerShell fallback...
goto :USE_POWERSHELL

:USE_POWERSHELL
where powershell.exe >nul 2>nul
if errorlevel 1 goto :NO_RUNTIME

echo [INFO] Starting built-in PowerShell server (Node.js not required).
echo [INFO] Stop with Ctrl+C. PowerShell may be slower than Node.
>>"logs\launcher.log" echo [%date% %time%] Using PowerShell TCP server.
call :OPEN_BROWSER
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "tools\serve-windows.ps1" -Port %NC_PORT%
set "NC_EXIT=%errorlevel%"
if "%NC_EXIT%"=="0" goto :STOPPED

echo.
echo [ERROR] PowerShell server exited with code %NC_EXIT%.
echo [INFO] Details: logs\launcher.log and logs\server.log
>>"logs\launcher.log" echo [%date% %time%] PowerShell server exit code %NC_EXIT%.
goto :FAIL

:OPEN_BROWSER
rem Nonblocking helper waits until the server ACTUALLY responds.
if exist "tools\open-browser.ps1" (
  where powershell.exe >nul 2>nul
  if not errorlevel 1 start "" /min powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\open-browser.ps1" -Port %NC_PORT%
)
exit /b 0

:BAD_DIRECTORY
echo [ERROR] Could not enter the game directory.
goto :FAIL

:NOT_EXTRACTED
echo.
echo [ERROR] Missing game files next to START_WINDOWS.bat.
echo Unpack the WHOLE ZIP to a normal folder first, then run this BAT.
echo Do not launch the BAT from inside the ZIP preview in Explorer.
goto :FAIL

:NO_RUNTIME
echo.
echo [ERROR] Neither Node.js 20+ nor Windows PowerShell is available.
echo Install Node.js from https://nodejs.org/ and restart the launcher.
goto :FAIL

:STOPPED
echo.
echo [INFO] Game server has stopped.
goto :END

:FAIL
echo.
echo [ERROR] The game was not started. See the messages above.
echo You can send logs\launcher.log and logs\server.log for diagnosis.
goto :END

:END
echo.
echo Press any key to close this window.
pause >nul
exit /b
