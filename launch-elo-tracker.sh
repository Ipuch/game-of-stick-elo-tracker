#!/bin/bash
# =============================================================
#  Game of Stick Elo Tracker – Linux/macOS Launcher
#  -------------------------------------------------------------
#  Priority order:
#    1. MANUAL_PATH below (if set)
#    2. Saved path from previous run (~/.elo-tracker-config)
#    3. Auto-detect relative to this script
#    4. Folder picker dialog (then saves for future)
# =============================================================

set -e

# >>> MANUAL OVERRIDE - Set this to always use a specific path <<<
MANUAL_PATH=""
# Example: MANUAL_PATH="/home/user/game-of-stick-elo-tracker/src-game-of-stick-elo-tracker"

# Config file to remember the path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.elo-tracker-config"

# Function to open folder picker
pick_folder() {
    local initial_dir="$1"
    
    # Try zenity (GNOME/Ubuntu)
    if command -v zenity &> /dev/null; then
        zenity --file-selection --directory --title="Select src-game-of-stick-elo-tracker folder" --filename="$initial_dir/" 2>/dev/null
        return
    fi
    
    # Try kdialog (KDE)
    if command -v kdialog &> /dev/null; then
        kdialog --getexistingdirectory "$initial_dir" --title "Select src-game-of-stick-elo-tracker folder" 2>/dev/null
        return
    fi
    
    # Fallback: prompt in terminal
    echo "No GUI dialog available. Please enter the path manually:" >&2
    read -r -p "Path to src-game-of-stick-elo-tracker: " manual_path
    echo "$manual_path"
}

# ---------------------------------------------------------------
# STEP 1: Check manual override
# ---------------------------------------------------------------
if [ -n "$MANUAL_PATH" ] && [ -f "$MANUAL_PATH/package.json" ]; then
    echo "✅ Using manual path: $MANUAL_PATH"
    PROJECT_DIR="$MANUAL_PATH"
elif [ -n "$MANUAL_PATH" ]; then
    echo "⚠️  WARNING: Manual path not valid: $MANUAL_PATH"
    echo "   Falling back to other methods..."
fi

# ---------------------------------------------------------------
# STEP 2: Check saved config from previous run
# ---------------------------------------------------------------
if [ -z "$PROJECT_DIR" ] && [ -f "$CONFIG_FILE" ]; then
    SAVED_PATH=$(cat "$CONFIG_FILE")
    if [ -f "$SAVED_PATH/package.json" ]; then
        echo "✅ Using saved path: $SAVED_PATH"
        PROJECT_DIR="$SAVED_PATH"
    else
        echo "⚠️  Saved path no longer valid. Will search again..."
        rm -f "$CONFIG_FILE"
    fi
fi

# ---------------------------------------------------------------
# STEP 3: Try auto-detect relative to script
# ---------------------------------------------------------------
if [ -z "$PROJECT_DIR" ]; then
    AUTO_DETECT="$SCRIPT_DIR/src-game-of-stick-elo-tracker"
    if [ -f "$AUTO_DETECT/package.json" ]; then
        echo "📂 Found project folder: $AUTO_DETECT"
        echo ""
        read -r -p "Use this folder and remember it? [Y/n] " response
        case "$response" in
            [nN][oO]|[nN])
                # Will fall through to picker
                ;;
            *)
                echo "$AUTO_DETECT" > "$CONFIG_FILE"
                echo "💾 Saved for future use."
                PROJECT_DIR="$AUTO_DETECT"
                ;;
        esac
    fi
fi

# ---------------------------------------------------------------
# STEP 4: Open folder picker dialog
# ---------------------------------------------------------------
if [ -z "$PROJECT_DIR" ]; then
    echo ""
    echo "📂 Please select the 'src-game-of-stick-elo-tracker' folder..."
    PROJECT_DIR=$(pick_folder "$SCRIPT_DIR")
    
    if [ -z "$PROJECT_DIR" ]; then
        echo "❌ No folder selected. Exiting."
        exit 1
    fi
    
    # Validate selection
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        echo "❌ ERROR: No package.json found in: $PROJECT_DIR"
        echo "   Please select the 'src-game-of-stick-elo-tracker' folder."
        exit 1
    fi
    
    # Save for future use
    echo "$PROJECT_DIR" > "$CONFIG_FILE"
    echo "💾 Saved path for future use: $PROJECT_DIR"
fi

echo ""
echo "🚀 Starting from: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm was not found. Install Node.js 18+: https://nodejs.org/"
    exit 1
fi

# Check Node.js version (requires 18+)
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ ERROR: Node.js 18+ is required. You have: $(node -v 2>/dev/null || echo 'not installed')"
    echo "   Download the latest LTS from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version OK: $(node -v)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Start the dev server
echo "🚀 Starting dev server..."
npm run dev &
DEV_PID=$!

# Wait for server to start
sleep 3

# Open browser
echo "🌐 Opening browser..."
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173/" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "http://localhost:5173/"
fi

echo ""
echo "✨ Server running! Press Ctrl+C to stop."
wait $DEV_PID
