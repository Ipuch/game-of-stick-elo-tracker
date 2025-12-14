# 🎮 Game of S.T.I.C.K. — ELO Tracker

> **Track player rankings, match history, and performance stats for Parkour "Stick" battles.**

![Game of Stick Elo Tracker Screenshot](screenshot.png)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **ELO Ratings** | Auto-calculated ratings with configurable K-factor |
| **Live Leaderboard** | Position changes (▲▼) and ELO diffs (+/-) |
| **Win/Loss Streaks** | 🔥 Win streaks, 🧊 Loss streaks with visual indicators |
| **Podium Display** | Top 3 players with medals 🥇🥈🥉 |
| **Combat Matrix** | Head-to-head stats visualized in a heatmap |
| **Player Profiles** | Detailed per-player stats and match history |
| **Multi-Window Sync** | Real-time sync between browser tabs |
| **File-Based Save** | Save games to local folders as CSV files |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your_username/game-of-stick-elo-tracker.git

# Navigate to the app directory
cd game-of-stick-elo-tracker/src-game-of-stick-elo-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📖 Step-by-Step Tutorial

### 1️⃣ Create or Load a Game

| Action | How |
|--------|-----|
| **Try Example Game** | Click "EXAMPLE GAME" to explore with sample data |
| **Create New Game** | Enter a name and K-factor, click "Initialize System" |
| **Load Saved Games** | Click "📂 Load Saved Games" → Select your folder |

### 2️⃣ Add Players

1. Go to **ADD PLAYERS** tab
2. Enter player name
3. Click **Add Player**

### 3️⃣ Record Matches

1. Go to **ARENA** tab
2. Select **Player 1** and **Player 2** from autocomplete
3. Choose winner: **P1 Wins**, **P2 Wins**, or **Draw**
4. Click **Record Result**

### 4️⃣ Update the Leaderboard

- Click **UPDATE LEADERBOARD** to see:
  - Position changes (▲▼ arrows)
  - ELO differences (+30, -15)
  - Current streaks (🔥 W3, 🧊 L2)

### 5️⃣ Save Your Game

1. Click **SAVE GAME** button
2. First time: Select a folder location
3. Data is saved as CSV files (`players.csv`, `matches.csv`)

### 6️⃣ Exit and Return

- Click **EXIT GAME** to return to the menu
- Your library folder stays selected for quick access

---

## 🔄 Multi-Window Sync

**Perfect for events!** Use two screens:
- **Screen 1**: Record matches (Arena view)
- **Screen 2**: Display leaderboard (Projector view)

### How It Works

1. Open the app in **two browser tabs/windows**
2. Load the **same game** in both
3. When you **Save** in one window, the other auto-updates
4. The display window shows:
   - Position changes since last save
   - ELO changes since last save
   - Updated streaks

> ⚡ Sync happens automatically via BroadcastChannel API — no server needed!

---

## 🛠️ Tech Stack

- **TypeScript** — Type-safe code
- **Vite** — Fast development and builds
- **File System Access API** — Local file persistence
- **BroadcastChannel API** — Cross-tab synchronization
- **Pure CSS** — No framework dependencies

---

## 📁 Project Structure

```
src-game-of-stick-elo-tracker/
├── index.html          # Main HTML
├── index.tsx           # App entry point
├── index.css           # Styles
├── types/              # TypeScript interfaces
├── state/              # Global store
├── renderers/          # UI rendering functions
├── handlers/           # Event handlers
├── utils/              # Utilities (ELO calc, CSV, persistence)
└── constants/          # App constants
```

---

## 📜 License

Apache 2.0 — See [LICENSE](LICENSE) for details.
