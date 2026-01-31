# 📺 Live Event Display - Implementation Plan

## Overview

A **Live Event Display** feature for Game of STICK that provides a dynamic, TV-ready view during live events. This display shows rankings with smooth scrolling and rotating highlight stories — perfect for projectors, large screens, or streaming overlays.

---

## 🎯 Goals

1. **Immersive live experience** for spectators during events
2. **Auto-scrolling leaderboard** that cycles through all players (especially useful for 15+ participants)
3. **Dynamic story highlights** showing exciting moments (streaks, upsets, ELO gains)
4. **Non-blocking** — can be exited instantly to return to game management
5. **Bilingual** — uses the existing i18n system (FR/EN)

---

## 🖥️ UI Concept: Split-Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🏆 GAME OF STICK — [Game Name]                    [X] Exit     │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│      📊 LIVE LEADERBOARD        │      ⚡ HIGHLIGHTS            │
│      ─────────────────          │      ────────────             │
│                                 │                               │
│   1. 🥇 Alice      1247 ELO     │   ┌─────────────────────────┐ │
│   2. 🥈 Bob        1198 ELO     │   │  🔥 UNSTOPPABLE         │ │
│   3. 🥉 Charlie    1156 ELO     │   │                         │ │
│   4.    David      1089 ELO     │   │     ALICE               │ │
│   5.    Emma       1045 ELO     │   │                         │ │
│   6.    Frank      1012 ELO     │   │      5                  │ │
│   ▼ scrolling...               │   │  Consecutive Wins       │ │
│   7.    Grace       998 ELO     │   └─────────────────────────┘ │
│   8.    Henry       976 ELO     │                               │
│   ...                           │   ── transitions every 8s ──  │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│  Last Match: Alice 🆚 Bob → Alice wins (+18 ELO)    🕐 14:32    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Elements

| Zone | Content | Behavior |
|------|---------|----------|
| **Header** | Game name, exit button | Static |
| **Left Panel (70%)** | Live leaderboard | Auto-scrolls when >10 players visible |
| **Right Panel (30%)** | Rotating highlight cards | Cycles through stories every 8-10s |
| **Footer** | Last match result + timestamp | Updates on each match |

---

## 📋 Features Breakdown

### 1. Live Leaderboard (Left Panel)

- **Full player list** sorted by ELO (descending)
- **Visual medals** for top 3 (🥇🥈🥉)
- **Diff features** diff elo, since last update, triangle red and green displayed.
- **Auto-scroll behavior:**
  - If ≤10 players: static list, no scroll
  - If >10 players: smooth vertical scroll (CSS animation or JS)
  - Scroll speed: ~2 seconds per player row (make easy accessible file to modify it)
  - Pause at top & bottom for 5 seconds before reversing
- **Real-time updates** — when a match is recorded, ELO and ranks update with subtle animation (Pierre comment: no for now the update should be made only based on the update button of the existing leaderboard through the sync mechanism.)

### 2. Highlight Stories (Right Panel)

Rotating cards showing exciting stats, reusing logic from `instagramExport.ts`:

| Story Type | Display | Source Function |
|------------|---------|-----------------|
| **Win Streak** 🔥 | "UNSTOPPABLE — [Name] — 5 Consecutive Wins" | `findBiggestWinStreak()` |
| **ELO Surge** ⚡ | "SKYROCKETING — [Name] — +32 in one match" | `findBiggestEloGain()` |
| **Upset** 💀 | "UNDERDOG WIN — [Name] beat 23% odds vs [Opponent]" | `findBiggestUpset()` |
| **Top Duel** ⚔️ | "CLASH OF TITANS — #1 vs #2 coming up" | New: `findTopDuel()` |
| **Current Champion** 👑 | "[Name] — 1247 ELO — 12W / 3L" | Top player stats |
| **Hungriest Dog** | "[Name] — 10 Match - 1247 ELO — 12W / 3L | Player with most matches | | New: `findMostDuel()̀ |

**Rotation Logic:**
- Cycle through available highlights every 8 seconds
- Smooth fade-in/fade-out transitions (CSS `opacity` + `transform`)
- If no highlights available, show current champion card

### 3. Footer: Last Match Ticker (Pierre comment: not yet ! to implement, because we only rely on sync mechanism for now.)

- Shows the most recent match result
- Format: `[Player1] 🆚 [Player2] → [Winner] wins (+[ELO change])`
- Timestamp from match
- Slides in from right when a new match is recorded

### 4. Exit Mechanism

- **Exit button** (top-right corner) — always visible
- **Keyboard shortcut**: `Escape` key
- Returns to the main game view (arena/leaderboard)
- Preserves all game state

---

## 🏗️ Implementation Steps

### Phase 1: Core Structure

1. **Create new renderer file**
   - `src-game-of-stick-elo-tracker/renderers/liveEventDisplay.ts`

2. **Add HTML container in `index.html`**
   ```html
   <div id="live-display-view" class="view hidden">
     <div class="live-header">...</div>
     <div class="live-content">
       <div class="live-leaderboard">...</div>
       <div class="live-highlights">...</div>
     </div>
     <div class="live-footer">...</div>
   </div>
   ```

3. **Add i18n keys** to `locales/en.json` and `locales/fr.json`
   ```json
   "liveDisplay": {
     "title": "Live Display",
     "leaderboard": "Leaderboard",
     "highlights": "Highlights",
     "exit": "Exit",
     "lastMatch": "Last Match",
     "clashOfTitans": "Clash of Titans",
     "currentChampion": "Current Champion"
   }
   ```

4. **Add navigation button** in LeaderBoard view
   - `📺 Live Display` button

### Phase 2: Leaderboard Component

1. **Render full player list** with rank, name, ELO
2. **Implement auto-scroll**
   - Use CSS `@keyframes` for smooth scrolling
   - Or JS `requestAnimationFrame` for more control
3. **Add real-time update hooks**
   - Listen for `match-recorded` events
   - Animate rank changes (slide up/down)

### Phase 3: Highlight Cards

1. **Refactor story generation** (Pierre: Yes !) from `instagramExport.ts`
   - Extract `findBiggestWinStreak`, `findBiggestEloGain`, `findBiggestUpset` to a shared utility
   - Create new `findTopDuel()` function

2. **Create highlight card component**
   - Accepts: `type`, `playerName`, `value`, `description`, `emoji`
   - Renders styled card (similar to Instagram story card but responsive)

3. **Implement rotation logic**
   ```typescript
   let currentHighlightIndex = 0;
   setInterval(() => {
     fadeOut(currentCard);
     currentHighlightIndex = (currentHighlightIndex + 1) % highlights.length;
     fadeIn(highlights[currentHighlightIndex]);
   }, 8000);
   ```

### Phase 4: Footer & Events

1. **Last match display** with slide-in animation
2. **Subscribe to store changes** for real-time updates
3. **Keyboard listener** for `Escape` to exit

### Phase 5: Styling & Polish

1. **Create CSS styles** in `index.css`
   - Dark theme optimized for large screens
   - High contrast for visibility
   - Smooth animations

2. **Responsive considerations**
   - Works on 1920x1080 (Full HD)
   - Scales down for smaller screens

3. **Optional: Fullscreen mode**
   - Button to enter browser fullscreen (`document.documentElement.requestFullscreen()`)

---

## 📁 File Changes Summary

| File | Changes |
|------|---------|
| `renderers/liveEventDisplay.ts` | **NEW** — Main renderer |
| `utils/storyHighlights.ts` | **NEW** — Shared highlight logic (extracted from instagramExport) |
| `utils/instagramExport.ts` | Refactor to use shared `storyHighlights.ts` |
| `index.html` | Add `#live-display-view` container + button |
| `index.tsx` | Add event handlers for live display |
| `index.css` | Add `.live-*` styles |
| `locales/en.json` | Add `liveDisplay` translations |
| `locales/fr.json` | Add `liveDisplay` translations |

---

## 🎨 Visual Design Notes

### Color Palette (Dark Theme for Events)

```css
--live-bg: #0a0a12;
--live-card: rgba(255, 255, 255, 0.05);
--live-accent: #00f3ff; /* Neon blue */
--live-gold: #ffd700;
--live-text: #ffffff;
--live-text-muted: rgba(255, 255, 255, 0.6);
```

### Typography

- **Headings**: Orbitron (same as Instagram stories)
- **Body**: Outfit or system sans-serif
- **Numbers/ELO**: Monospace or Orbitron for visual impact

### Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Leaderboard scroll | `translateY` | 3s per row |
| Highlight card transition | `opacity` + `scale` | 0.5s |
| Rank change | `translateY` + color pulse | 0.8s |
| Last match ticker | `translateX` slide-in | 0.4s |

---

## 🔮 Future Extensions

1. **Aggregated Mode** — Show stats across all games in library
2. **Tournament Bracket View** — For elimination-style events
3. **Sound Effects** — Optional audio cues for rank changes
4. **OBS Integration** — Browser source URL for streaming overlays
5. **QR Code** — Display QR for spectators to view on phones
6. **Head-to-Head Preview** — Before a match, show H2H stats

---

## ✅ Acceptance Criteria

- [ ] Live display accessible from in-game view
- [ ] Leaderboard shows all players with auto-scroll for 10+
- [ ] Highlights rotate every 8 seconds with smooth transitions
- [ ] Exit button returns to game immediately
- [ ] `Escape` key also exits
- [ ] All text uses i18n (FR/EN)
- [ ] Real-time updates when matches are recorded
- [ ] Works well on 1920x1080 displays

---

## 📅 Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Core Structure | 2 hours |
| Phase 2: Leaderboard | 3 hours |
| Phase 3: Highlight Cards | 2 hours |
| Phase 4: Footer & Events | 1 hour |
| Phase 5: Styling & Polish | 2 hours |
| **Total** | **~10 hours** |

---

## 🚀 Let's Build It!

Ready to start implementation? Begin with Phase 1 by creating the file structure and HTML container.
