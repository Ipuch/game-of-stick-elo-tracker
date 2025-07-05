@echo off
REM =============================================================
REM  Game of Stick Elo Tracker – Windows Launcher
REM  -------------------------------------------------------------
REM  HOW TO USE:
REM  1. Replace the path below (PROJECT_DIR) with the absolute path
REM     to the "src-game-of-stick-elo-tracker" folder on your machine.
REM  2. Save the file and double-click it to start the dev server.
REM  3. Your default browser will open at http://localhost:5173
REM =============================================================

REM >>> EDIT THIS LINE <<<
set "PROJECT_DIR=C:\Path\to\game-of-stick-elo-tracker\src-game-of-stick-elo-tracker"

REM --------------------------------------------------------------
if not exist "%PROJECT_DIR%" (
    echo The directory "%PROJECT_DIR%" was not found.
    echo Please edit launch-elo-tracker.bat and set PROJECT_DIR to the correct path.
    pause
    exit /b 1
)

pushd "%PROJECT_DIR%"

REM Make sure Node and npm are available
where npm >nul 2>nul || (
    echo npm was not found in PATH. Install Node.js first: https://nodejs.org/
    pause
    popd
    exit /b 1
)

REM Install dependencies if node_modules is missing
if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
)

REM Launch the Vite dev server in a new terminal window
start "Elo Tracker Dev Server" cmd /k "npm run dev"

REM Optional: wait a few seconds for the server to come online (adjust if needed)
timeout /t 5 >nul

REM Open default browser
start "Elo Tracker" http://localhost:5173/

popd

pause
