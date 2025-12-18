@echo off
REM =============================================================
REM  Game of Stick Elo Tracker – Windows Launcher
REM  -------------------------------------------------------------
REM  Priority order:
REM    1. MANUAL_PATH below (if set)
REM    2. Saved path from previous run (elo-tracker-config.txt)
REM    3. Auto-detect relative to this script
REM    4. Folder picker dialog (then saves for future)
REM =============================================================

setlocal enabledelayedexpansion

REM >>> MANUAL OVERRIDE - Set this to always use a specific path <<<
set "MANUAL_PATH="
REM Example: set "MANUAL_PATH=C:\Projects\game-of-stick-elo-tracker\src-game-of-stick-elo-tracker"

REM Config file to remember the path
set "CONFIG_FILE=%~dp0elo-tracker-config.txt"

REM ---------------------------------------------------------------
REM STEP 1: Check manual override
REM ---------------------------------------------------------------
if defined MANUAL_PATH if not "!MANUAL_PATH!"=="" (
    if exist "!MANUAL_PATH!\package.json" (
        echo Using manual path: !MANUAL_PATH!
        set "PROJECT_DIR=!MANUAL_PATH!"
        goto :start_server
    ) else (
        echo WARNING: Manual path not valid: !MANUAL_PATH!
        echo Falling back to other methods...
    )
)

REM ---------------------------------------------------------------
REM STEP 2: Check saved config from previous run
REM ---------------------------------------------------------------
if exist "!CONFIG_FILE!" (
    set /p SAVED_PATH=<"!CONFIG_FILE!"
    if exist "!SAVED_PATH!\package.json" (
        echo Using saved path: !SAVED_PATH!
        set "PROJECT_DIR=!SAVED_PATH!"
        goto :start_server
    ) else (
        echo WARNING: Saved path no longer valid. Will search again...
        del "!CONFIG_FILE!" 2>nul
    )
)

REM ---------------------------------------------------------------
REM STEP 3: Try auto-detect relative to script
REM ---------------------------------------------------------------
set "AUTO_DETECT=%~dp0src-game-of-stick-elo-tracker"
if exist "!AUTO_DETECT!\package.json" (
    echo Found project folder: !AUTO_DETECT!
    echo.
    choice /C YN /M "Use this folder and remember it"
    if !errorlevel! equ 1 (
        echo !AUTO_DETECT!>"!CONFIG_FILE!"
        echo Saved for future use.
        set "PROJECT_DIR=!AUTO_DETECT!"
        goto :start_server
    )
)

REM ---------------------------------------------------------------
REM STEP 4: Open folder picker dialog
REM ---------------------------------------------------------------
echo.
echo Please select the "src-game-of-stick-elo-tracker" folder...
echo.

set "INITIAL_DIR=%~dp0"
for /f "delims=" %%I in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select the src-game-of-stick-elo-tracker folder'; $f.SelectedPath = '%INITIAL_DIR:\=\\%'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"') do set "PROJECT_DIR=%%I"

if not defined PROJECT_DIR (
    echo No folder selected. Exiting.
    pause
    exit /b 1
)

REM Validate selection
if not exist "!PROJECT_DIR!\package.json" (
    echo ERROR: No package.json found in: !PROJECT_DIR!
    echo Please select the "src-game-of-stick-elo-tracker" folder.
    pause
    exit /b 1
)

REM Save for future use
echo !PROJECT_DIR!>"!CONFIG_FILE!"
echo Saved path for future use: !PROJECT_DIR!

:start_server
echo.
echo Starting from: !PROJECT_DIR!
echo.

pushd "!PROJECT_DIR!"

REM Make sure npm is available
where npm >nul 2>nul || (
    echo npm was not found. Install Node.js 18+: https://nodejs.org/
    pause
    popd
    exit /b 1
)

REM Check Node.js version (requires 18+)
for /f "tokens=1 delims=v." %%V in ('node -v 2^>nul') do set "NODE_MAJOR=%%V"
for /f "tokens=2 delims=v." %%V in ('node -v 2^>nul') do set "NODE_MAJOR=%%V"
if !NODE_MAJOR! LSS 18 (
    echo ERROR: Node.js 18+ is required. You have: 
    node -v
    echo Download the latest LTS from: https://nodejs.org/
    pause
    popd
    exit /b 1
)
echo Node.js version OK:

REM Install dependencies if needed
if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
)

REM Launch the dev server
start "Elo Tracker Dev Server" cmd /k "npm run dev"

REM Wait and open browser
echo Waiting for server...
timeout /t 5 >nul
start "" http://localhost:5173/

popd
endlocal
