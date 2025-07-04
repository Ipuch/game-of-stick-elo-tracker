/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TYPE DEFINITIONS ---
interface Player {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  previousRank: number; // 0 if new or unranked
  currentStreakType: 'W' | 'L' | null; // 'W' for win, 'L' for loss, null for no streak
  currentStreakLength: number; // Length of the current streak
  lastEloChange?: number; // Optional: Stores the last ELO change for display
}

interface Match {
    id: string;
    timestamp: number;
    player1Id: string;
    player2Id: string;
    player1Name: string;
    player2Name: string;
    player1EloBefore: number;
    player2EloBefore: number;
    player1EloAfter: number;
    player2EloAfter: number;
    outcome: 'p1' | 'p2' | 'draw';
    player1EloChange?: number; // Optional: Stores ELO change for Player 1
    player2EloChange?: number; // Optional: Stores ELO change for Player 2
}

interface AppDOMElements {
    leaderboardBody: HTMLTableSectionElement | null;
    leaderboardSection: HTMLElement | null;
    updateLeaderboardBtnContainer: HTMLElement | null;
    updateLeaderboardBtn: HTMLButtonElement | null;
    addPlayerForm: HTMLFormElement | null;
    newPlayerNameInput: HTMLInputElement | null;
    addPlayerError: HTMLParagraphElement | null;
    recordMatchForm: HTMLFormElement | null;
    player1Input: HTMLInputElement | null;
    player1IdInput: HTMLInputElement | null;
    player1Suggestions: HTMLElement | null;
    player2Input: HTMLInputElement | null;
    player2IdInput: HTMLInputElement | null;
    player2Suggestions: HTMLElement | null;
    winnerP1Label: HTMLLabelElement | null;
    winnerP2Label: HTMLLabelElement | null;
    matchError: HTMLParagraphElement | null;
    podiumContainer: HTMLElement | null;
    kFactorInput: HTMLInputElement | null;
    settingsForm: HTMLFormElement | null;
    realtimeUpdateToggle: HTMLInputElement | null;
    exportPlayersBtn: HTMLButtonElement | null;
    exportMatchesBtn: HTMLButtonElement | null;
    toggleBattleHistoryBtn: HTMLButtonElement | null;
    battleHistoryContainer: HTMLElement | null;
    battleHistoryList: HTMLElement | null;
    importMatchesFile: HTMLInputElement | null;
    importPlayersFile: HTMLInputElement | null;
    clearHistoryBtn: HTMLButtonElement | null;
    clearPlayersBtn: HTMLButtonElement | null;
}

// --- CONSTANTS ---
const INITIAL_ELO = 1200;
const PLAYERS_STORAGE_KEY = 'game-of-stick-players';
const MATCH_HISTORY_STORAGE_KEY = 'game-of-stick-match-history';
const SETTINGS_STORAGE_KEY = 'game-of-stick-settings';
const DEFAULT_K_FACTOR = 60;

// --- STATE ---
let players: Player[] = [];
let matchHistory: Match[] = [];
let kFactor: number = DEFAULT_K_FACTOR;
let isRealtimeUpdate: boolean = true;

// --- DOM ELEMENTS ---
let DOMElements: AppDOMElements;

function queryDOMElements() {
    DOMElements = {
        leaderboardBody: document.getElementById('leaderboard-body') as HTMLTableSectionElement,
        leaderboardSection: document.querySelector('.leaderboard-section'),
        updateLeaderboardBtnContainer: document.getElementById('update-leaderboard-container'),
        updateLeaderboardBtn: document.getElementById('update-leaderboard-btn') as HTMLButtonElement,
        addPlayerForm: document.getElementById('add-player-form') as HTMLFormElement,
        newPlayerNameInput: document.getElementById('new-player-name') as HTMLInputElement,
        addPlayerError: document.getElementById('add-player-error') as HTMLParagraphElement,
        recordMatchForm: document.getElementById('record-match-form') as HTMLFormElement,
        player1Input: document.getElementById('player1-input') as HTMLInputElement,
        player1IdInput: document.getElementById('player1-id') as HTMLInputElement,
        player1Suggestions: document.getElementById('player1-suggestions') as HTMLElement,
        player2Input: document.getElementById('player2-input') as HTMLInputElement,
        player2IdInput: document.getElementById('player2-id') as HTMLInputElement,
        player2Suggestions: document.getElementById('player2-suggestions') as HTMLElement,
        winnerP1Label: document.getElementById('winner-p1-label') as HTMLLabelElement,
        winnerP2Label: document.getElementById('winner-p2-label') as HTMLLabelElement,
        matchError: document.getElementById('match-error') as HTMLParagraphElement,
        podiumContainer: document.getElementById('podium-container'),
        kFactorInput: document.getElementById('k-factor-input') as HTMLInputElement,
        settingsForm: document.getElementById('settings-form') as HTMLFormElement,
        realtimeUpdateToggle: document.getElementById('realtime-update-toggle') as HTMLInputElement,
        exportPlayersBtn: document.getElementById('export-players-btn') as HTMLButtonElement,
        exportMatchesBtn: document.getElementById('export-matches-btn') as HTMLButtonElement,
        toggleBattleHistoryBtn: document.getElementById('toggle-battle-history-btn') as HTMLButtonElement,
        battleHistoryContainer: document.getElementById('battle-history-container') as HTMLElement,
        battleHistoryList: document.getElementById('battle-history-list') as HTMLElement,
        importMatchesFile: document.getElementById('import-matches-file') as HTMLInputElement,
        importPlayersFile: document.getElementById('import-players-file') as HTMLInputElement,
        clearHistoryBtn: document.getElementById('clear-history-btn') as HTMLButtonElement,
        clearPlayersBtn: document.getElementById('clear-players-btn') as HTMLButtonElement,
    };
}


// --- CORE LOGIC: ELO Calculation ---
function calculateElo(
  p1Elo: number,
  p2Elo: number,
  winner: 'p1' | 'p2' | 'draw'
): { newP1Elo: number; newP2Elo: number } {
  const expectedScoreP1 = 1 / (1 + 10 ** ((p2Elo - p1Elo) / 400));
  const expectedScoreP2 = 1 / (1 + 10 ** ((p1Elo - p2Elo) / 400));

  let actualScoreP1: number, actualScoreP2: number;

  if (winner === 'p1') {
    actualScoreP1 = 1;
    actualScoreP2 = 0;
  } else if (winner === 'p2') {
    actualScoreP1 = 0;
    actualScoreP2 = 1;
  } else { // Draw
    actualScoreP1 = 0.5;
    actualScoreP2 = 0.5;
  }

  const newP1Elo = Math.round(p1Elo + kFactor * (actualScoreP1 - expectedScoreP1));
  const newP2Elo = Math.round(p2Elo + kFactor * (actualScoreP2 - expectedScoreP2));

  return { newP1Elo, newP2Elo };
}

// --- DATA PERSISTENCE ---
function saveState() {
  localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
  localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(matchHistory));
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ kFactor, isRealtimeUpdate }));
}

function loadState() {
  const storedPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
  if (storedPlayers) {
    const parsedPlayers: Player[] = JSON.parse(storedPlayers);
    // Backward compatibility
    players = parsedPlayers.map(p => ({
        ...p,
        wins: p.wins || 0,
        losses: p.losses || 0,
        draws: p.draws || 0,
        previousRank: p.previousRank || 0,
        currentStreakType: p.currentStreakType || null,
        currentStreakLength: p.currentStreakLength || 0,
    }));
  }

  const storedMatchHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
  if(storedMatchHistory) {
      matchHistory = JSON.parse(storedMatchHistory);
  }

  const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    const settings = JSON.parse(storedSettings);
    kFactor = settings.kFactor || DEFAULT_K_FACTOR;
    // Use ?? to correctly handle 'false' values
    isRealtimeUpdate = settings.isRealtimeUpdate ?? true;
  }
  
  if (DOMElements.kFactorInput) {
    DOMElements.kFactorInput.value = kFactor.toString();
  }
  if (DOMElements.realtimeUpdateToggle) {
    DOMElements.realtimeUpdateToggle.checked = isRealtimeUpdate;
  }
}

// --- UI UPDATE ---
function toggleUpdateModeUI() {
    if (!DOMElements.updateLeaderboardBtnContainer || !DOMElements.leaderboardSection) return;
    if (isRealtimeUpdate) {
        DOMElements.updateLeaderboardBtnContainer.setAttribute('hidden', 'true');
        DOMElements.leaderboardSection.classList.remove('manual-update-mode');
    } else {
        DOMElements.updateLeaderboardBtnContainer.removeAttribute('hidden');
        DOMElements.leaderboardSection.classList.add('manual-update-mode');
    }
}

function updateKFactorInputState() {
    const { kFactorInput } = DOMElements;
    if (!kFactorInput) return;

    const kFactorFormGroup = kFactorInput.closest('.form-group');
    if (!kFactorFormGroup) return;

    if (matchHistory.length > 0) {
        kFactorInput.disabled = true;
        kFactorFormGroup.setAttribute('title', 'K-Factor is locked after the first match is recorded to ensure ranking consistency.');
        kFactorFormGroup.classList.add('disabled');
    } else {
        kFactorInput.disabled = false;
        kFactorFormGroup.removeAttribute('title');
        kFactorFormGroup.classList.remove('disabled');
    }
}


// --- RENDERING ---
function renderPodium() {
    if (!DOMElements.podiumContainer) return;

    // Get top 3 players, sorted by ELO (descending)
    const topThree = [...players].sort((a, b) => b.elo - a.elo).slice(0, 3);
    
    DOMElements.podiumContainer.innerHTML = '';
    DOMElements.podiumContainer.style.display = topThree.length > 0 ? 'flex' : 'none';
    if (topThree.length === 0) return; // Hide podium if no players

    // Define podium spots and their visual properties
    const podiumSpots = [
        { rank: 2, className: 'second', icon: '🥈' },
        { rank: 1, className: 'first', icon: '👑' }, // Crown for 1st place as per spec
        { rank: 3, className: 'third', icon: '🥉' },
    ];

    // Filter out spots if less than 3 players
    const visiblePodiumSpots = podiumSpots.filter(spot => spot.rank <= topThree.length);

    // Map top three players to their podium positions
    const rankedPlayers: { [key: number]: Player } = {};
    topThree.forEach((player, index) => {
        rankedPlayers[index + 1] = player;
    });

    visiblePodiumSpots.forEach(spotConfig => {
        const player = rankedPlayers[spotConfig.rank];
        if (player) { // Should always be true due to filtering, but good for safety
            const spot = document.createElement('div');
            spot.classList.add('podium-spot', spotConfig.className);

            const keyStat = calculateWinLossRatio(player); // Default to W/L Ratio

            spot.innerHTML = `
                <div class="podium-icon-container"><span class="podium-icon">${spotConfig.icon}</span></div>
                <div class="podium-name">${player.name}</div>
                <div class="podium-elo">${player.elo} ELO</div>
                <div class="podium-key-stat">${keyStat}</div>
            `;
            DOMElements.podiumContainer!.appendChild(spot);
        }
    });
}

function calculateWinLossRatio(player: Player): string {
    const totalGames = player.wins + player.losses;
    if (totalGames === 0) {
        return '0 W/L';
    }
    const ratio = (player.wins / totalGames) * 100;
    return `${ratio.toFixed(1)}% W/L`;
}

function renderLeaderboard() {
  if (!DOMElements.leaderboardBody) return;
  
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
  
  console.log('Rendering Leaderboard with players:', sortedPlayers);

  DOMElements.leaderboardBody.innerHTML = '';

  if (players.length === 0) {
    DOMElements.leaderboardBody.innerHTML = `<tr><td colspan="7">No players yet. Add one below!</td></tr>`;
    return;
  }

  sortedPlayers.forEach((player, index) => {
    const newRank = index + 1;
    const oldRank = player.previousRank;

    let rankChangeIndicator = '';
    if (oldRank) { // Only show indicators for players who were ranked before
        const diff = oldRank - newRank;
        if (diff > 0) { // Rank improved (e.g., from 3 to 1, diff is 2)
            rankChangeIndicator = `<span class="rank-change rank-up">▲ ${diff}</span>`;
        } else if (diff < 0) { // Rank worsened (e.g., from 1 to 3, diff is -2)
            rankChangeIndicator = `<span class="rank-change rank-down">▼ ${Math.abs(diff)}</span>`;
        } else { // Rank is the same
            rankChangeIndicator = `<span class="rank-change rank-no-change">=</span>`;
        }
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div>${newRank} ${rankChangeIndicator}</div></td>
      <td>${player.name} ${renderStreak(player.currentStreakType, player.currentStreakLength)}</td>
      <td>
        ${player.elo}
        ${player.lastEloChange !== undefined && player.lastEloChange !== 0 
          ? `<span class="elo-change ${player.lastEloChange > 0 ? 'elo-up' : 'elo-down'}">(${player.lastEloChange > 0 ? '+' : ''}${player.lastEloChange})</span>` 
          : ''}
      </td>
      <td>${player.wins}</td>
      <td>${player.losses}</td>
      <td>${player.draws}</td>
      <td>${player.wins + player.losses + player.draws}</td>
    `;
    DOMElements.leaderboardBody!.appendChild(row);
  });
  
  // After rendering, update previousRank for all players for the next calculation
  players.forEach(p => {
    const sortedIndex = sortedPlayers.findIndex(sp => sp.id === p.id);
    if(sortedIndex !== -1) {
        p.previousRank = sortedIndex + 1;
    }
  });

  // After updating ranks, recalculate streaks
  calculatePlayerStreaks();
}

function renderBattleHistory() {
    if (!DOMElements.battleHistoryList) return;
    if (matchHistory.length === 0) {
        DOMElements.battleHistoryList.innerHTML = '<div class="battle-history-entry">No matches recorded yet.</div>';
        return;
    }
    // Reverse chronological order
    const matches = [...matchHistory].sort((a, b) => b.timestamp - a.timestamp);
    DOMElements.battleHistoryList.innerHTML = '';
    matches.forEach(match => {
        // Win probability calculation (before match)
        const expectedScoreP1 = 1 / (1 + 10 ** ((match.player2EloBefore - match.player1EloBefore) / 400));
        const expectedScoreP2 = 1 - expectedScoreP1;
        const p1Prob = Math.round(expectedScoreP1 * 100);
        const p2Prob = 100 - p1Prob;
        // Outcome text
        let outcomeText = '';
        if (match.outcome === 'p1') outcomeText = `${match.player1Name} Won`;
        else if (match.outcome === 'p2') outcomeText = `${match.player2Name} Won`;
        else outcomeText = 'Draw';
        // Timestamp
        const date = new Date(match.timestamp);
        const timestampStr = date.toLocaleString();
        // Entry HTML
        const entry = document.createElement('div');
        entry.className = 'battle-history-entry';
        entry.innerHTML = `
            <div class="battle-history-header">
                <span class="battle-history-players">
                    ${match.player1Name} <span style="color:#888;font-size:0.95em">(${match.player1EloBefore} ELO ${match.player1EloChange ? (match.player1EloChange > 0 ? '<span class="elo-up">+' : '<span class="elo-down">' ) + match.player1EloChange + '</span>' : ''})</span>
                    vs.
                    ${match.player2Name} <span style="color:#888;font-size:0.95em">(${match.player2EloBefore} ELO ${match.player2EloChange ? (match.player2EloChange > 0 ? '<span class="elo-up">+' : '<span class="elo-down">' ) + match.player2EloChange + '</span>' : ''})</span>
                </span>
                <span class="battle-history-timestamp">${timestampStr}</span>
            </div>
            <div class="battle-history-outcome">${outcomeText}</div>
            <div class="battle-history-winprob-bar">
                <span class="winprob-label">${match.player1Name}: ${p1Prob}%</span>
                <div class="winprob-bar">
                    <div class="winprob-bar-p1" style="width:${p1Prob}%;"></div>
                    <div class="winprob-bar-p2" style="width:${p2Prob}%;"></div>
                </div>
                <span class="winprob-label">${match.player2Name}: ${p2Prob}%</span>
            </div>
        `;
        DOMElements.battleHistoryList!.appendChild(entry);
    });
}

function render() {
  // console.log('render() function called.'); // Removed for debugging
  renderLeaderboard();
  renderPodium();
  renderBattleHistory();
  // Now that ranks are updated (including previousRank), save the state.
  saveState();
}

// --- UTILITY FUNCTIONS ---
function generateUUID() {
    if (self.crypto && self.crypto.randomUUID) {
        return self.crypto.randomUUID();
    }
    // Fallback for older browsers or non-secure contexts
    // @ts-ignore
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function escapeCsvValue(value: any): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function downloadFile(content: string, filename: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- EVENT HANDLERS ---
function handleAddPlayer(event: SubmitEvent) {
  event.preventDefault();
  const name = DOMElements.newPlayerNameInput?.value.trim();

  if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = '';
  
  if (!name) {
    if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = 'Player name cannot be empty.';
    return;
  }

  if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
     if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = 'A player with this name already exists.';
  } else {
    const newPlayer: Player = {
      id: generateUUID(),
      name: name,
      elo: INITIAL_ELO,
      wins: 0,
      losses: 0,
      draws: 0,
      previousRank: 0, // New players are unranked
      currentStreakType: null, // New: Initialize streak
      currentStreakLength: 0,  // New: Initialize streak
    };
    players.push(newPlayer);
    
    if (isRealtimeUpdate) {
        render(); // This will also save the state
    } else {
        saveState();
    }

    if(DOMElements.newPlayerNameInput) DOMElements.newPlayerNameInput.value = '';
  }
}

function handleRecordMatch(event: SubmitEvent) {
  event.preventDefault();
  const form = event.target as HTMLFormElement;

  const p1Id = DOMElements.player1IdInput?.value;
  const p2Id = DOMElements.player2IdInput?.value;
  
  const formData = new FormData(form);
  const winner = formData.get('winner') as 'p1' | 'p2' | 'draw' | null;
  
  if (DOMElements.matchError) DOMElements.matchError.textContent = '';

  if (!p1Id || !p2Id) {
      if (DOMElements.matchError) DOMElements.matchError.textContent = 'Please select both players from the list.';
      return;
  }

  if (p1Id === p2Id) {
      if (DOMElements.matchError) DOMElements.matchError.textContent = 'Players cannot be the same.';
      return;
  }
  
  if (!winner) {
      if (DOMElements.matchError) DOMElements.matchError.textContent = 'Please select the outcome.';
      return;
  }

  const player1 = players.find(p => p.id === p1Id);
  const player2 = players.find(p => p.id === p2Id);

  if (!player1 || !player2) {
      if (DOMElements.matchError) DOMElements.matchError.textContent = 'One or more players not found.';
      return;
  }

  const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, winner);
  
  const newMatch: Match = {
      id: generateUUID(),
      timestamp: Date.now(),
      player1Id: player1.id,
      player2Id: player2.id,
      player1Name: player1.name,
      player2Name: player2.name,
      player1EloBefore: player1.elo,
      player2EloBefore: player2.elo,
      player1EloAfter: newP1Elo,
      player2EloAfter: newP2Elo,
      outcome: winner,
      player1EloChange: newP1Elo - player1.elo, // Calculate ELO change for Player 1
      player2EloChange: newP2Elo - player2.elo, // Calculate ELO change for Player 2
  };
  matchHistory.push(newMatch);

  const oldP1Elo = player1.elo; // Capture ELO before update
  const oldP2Elo = player2.elo; // Capture ELO before update

  player1.elo = newP1Elo;
  player2.elo = newP2Elo;

  player1.lastEloChange = newP1Elo - oldP1Elo; // Calculate and store ELO change
  player2.lastEloChange = newP2Elo - oldP2Elo; // Calculate and store ELO change

  if (winner === 'p1') {
      player1.wins++;
      player2.losses++;
  } else if (winner === 'p2') {
      player1.losses++;
      player2.wins++;
  } else { // Draw
      player1.draws++;
      player2.draws++;
  }

  // After updating stats, recalculate streaks
  calculatePlayerStreaks();

  updateKFactorInputState();

  if (isRealtimeUpdate) {
    render();
  } else {
    saveState();
  }
  
  form.reset();
  if (DOMElements.player1Input) DOMElements.player1Input.value = '';
  if (DOMElements.player2Input) DOMElements.player2Input.value = '';
  updateWinnerLabels();
  hideSuggestions(DOMElements.player1Suggestions);
  hideSuggestions(DOMElements.player2Suggestions);
}

function updateWinnerLabels() {
    const { player1Input, player2Input, winnerP1Label, winnerP2Label } = DOMElements;
    if (!player1Input || !player2Input || !winnerP1Label || !winnerP2Label) return;
    
    const p1Name = player1Input.value.trim() || 'Player 1';
    const p2Name = player2Input.value.trim() || 'Player 2';
    
    winnerP1Label.textContent = `${p1Name} Wins`;
    winnerP2Label.textContent = `${p2Name} Wins`;
}

function handleKFactorChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (!isNaN(value) && value > 0) {
        kFactor = value;
        saveState();
    }
}

function handleRealtimeUpdateToggle(event: Event) {
    const target = event.target as HTMLInputElement;
    isRealtimeUpdate = target.checked;
    // If user toggles it on, refresh the leaderboard immediately.
    if (isRealtimeUpdate) {
        render();
    } else {
        saveState();
    }
    toggleUpdateModeUI();
}

function handleUpdateLeaderboardClick() {
    render();
}

function handleExportPlayers() {
    if (players.length === 0) {
        alert('No players to export.');
        return;
    }

    const headers = ['Player Name', 'Initial ELO'];
    const csvRows = [headers.join(',')];

    players.forEach(player => {
        const row = [
            escapeCsvValue(player.name),
            INITIAL_ELO
        ].join(',');
        csvRows.push(row);
    });

    downloadFile(csvRows.join('\n'), 'game-of-stick-players.csv', 'text/csv;charset=utf-8;');
}

function handleExportMatches() {
    if (matchHistory.length === 0) {
        alert('No match history to export.');
        return;
    }

    const headers = ['Timestamp', 'Player 1', 'Player 2', 'Outcome', 'P1 ELO Before', 'P1 ELO After', 'P2 ELO Before', 'P2 ELO After'];
    const csvRows = [headers.join(',')];

    matchHistory.forEach(match => {
        let outcomeText = 'Draw';
        if (match.outcome === 'p1') outcomeText = `${match.player1Name} Wins`;
        if (match.outcome === 'p2') outcomeText = `${match.player2Name} Wins`;

        const row = [
            escapeCsvValue(new Date(match.timestamp).toISOString()),
            escapeCsvValue(match.player1Name),
            escapeCsvValue(match.player2Name),
            escapeCsvValue(outcomeText),
            match.player1EloBefore,
            match.player1EloAfter,
            match.player2EloBefore,
            match.player2EloAfter,
        ].join(',');
        csvRows.push(row);
    });

    downloadFile(csvRows.join('\n'), 'game-of-stick-matches.csv', 'text/csv;charset=utf-8;');
}

async function handleImportMatches(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
        alert('No file selected.');
        return;
    }

    if (file.type !== 'text/csv') {
        alert('Please upload a CSV file.');
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
            alert('Failed to read file.');
            return;
        }

        const lines = text.trim().split('\n');
        if (lines.length <= 1) { // Header + potentially empty data
            alert('CSV file is empty or only contains headers.');
            return;
        }

        const importedMatches: Match[] = [];
        const existingPlayerNames = new Set(players.map(p => p.name.toLowerCase()));
        const playersBeforeImport = new Map(players.map(p => [p.id, p.elo])); // Store initial ELOs for rank change

        for (let i = 1; i < lines.length; i++) { // Start from 1 to skip header
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 3) {
                console.warn(`Skipping malformed row: ${line}`);
                continue;
            }

            const player1Name = parts[1].trim();
            const player2Name = parts[2].trim();
            const outcomeTextRaw = parts[3].trim(); // Corrected index for outcome text

            let outcome: 'p1' | 'p2' | 'draw';
            if (outcomeTextRaw.includes(player1Name) && outcomeTextRaw.includes('Won')) outcome = 'p1';
            else if (outcomeTextRaw.includes(player2Name) && outcomeTextRaw.includes('Won')) outcome = 'p2';
            else if (outcomeTextRaw === 'Draw') outcome = 'draw';
            else {
                console.warn(`Skipping row with unparseable outcome text '${outcomeTextRaw}': ${line}`);
                continue;
            }

            // Find or create player1
            let player1 = players.find(p => p.name.toLowerCase() === player1Name.toLowerCase());
            if (!player1) {
                player1 = {
                    id: generateUUID(),
                    name: player1Name,
                    elo: INITIAL_ELO,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    previousRank: 0,
                    currentStreakType: null, // New: Initialize streak
                    currentStreakLength: 0,  // New: Initialize streak
                };
                players.push(player1);
                existingPlayerNames.add(player1Name.toLowerCase()); // Add new player to set
            }

            // Find or create player2
            let player2 = players.find(p => p.name.toLowerCase() === player2Name.toLowerCase());
            if (!player2) {
                player2 = {
                    id: generateUUID(),
                    name: player2Name,
                    elo: INITIAL_ELO,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    previousRank: 0,
                    currentStreakType: null, // New: Initialize streak
                    currentStreakLength: 0,  // New: Initialize streak
                };
                players.push(player2);
                existingPlayerNames.add(player2Name.toLowerCase()); // Add new player to set
            }

            if (player1.id === player2.id) {
                console.warn(`Skipping match: Player 1 and Player 2 are the same in row: ${line}`);
                continue;
            }
            
            // Capture ELOs BEFORE this specific match for history record
            const p1EloBeforeMatch = player1.elo;
            const p2EloBeforeMatch = player2.elo;

            const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, outcome);
            
            const newMatch: Match = {
                id: generateUUID(),
                timestamp: Date.now(), // Use current time for imported matches for simplicity
                player1Id: player1.id,
                player2Id: player2.id,
                player1Name: player1.name,
                player2Name: player2.name,
                player1EloBefore: p1EloBeforeMatch,
                player2EloBefore: p2EloBeforeMatch,
                player1EloAfter: newP1Elo,
                player2EloAfter: newP2Elo,
                outcome: outcome,
                player1EloChange: newP1Elo - p1EloBeforeMatch, // Calculate ELO change for Player 1
                player2EloChange: newP2Elo - p2EloBeforeMatch, // Calculate ELO change for Player 2
            };
            importedMatches.push(newMatch);

            player1.elo = newP1Elo;
            player2.elo = newP2Elo;

            if (outcome === 'p1') {
                player1.wins++;
                player2.losses++;
            } else if (outcome === 'p2') {
                player1.losses++;
                player2.wins++;
            } else { // Draw
                player1.draws++;
                player2.draws++;
            }
        }
        
        // Append new matches to history (ensure chronological if timestamps were accurate in CSV, here we use Date.now() for simplicity)
        matchHistory.push(...importedMatches);
        
        // For existing players, calculate new previousRanks after import
        const sortedPlayersAfterImport = [...players].sort((a, b) => b.elo - a.elo);
        players.forEach(p => {
            const sortedIndex = sortedPlayersAfterImport.findIndex(sp => sp.id === p.id);
            if (sortedIndex !== -1) {
                p.previousRank = sortedIndex + 1;
            }
        });

        // After updating players and ranks, recalculate streaks
        calculatePlayerStreaks();

        updateKFactorInputState();
        console.log('handleImportMatches: Players state before render:', players);
        console.log('handleImportMatches: Match History state before render:', matchHistory);
        render(); // Re-render leaderboard, podium, and history, and save state
        alert(`Successfully imported ${importedMatches.length} matches.`);
    };

    reader.onerror = () => {
        alert('Error reading file.');
    };

    reader.readAsText(file);

    // Clear file input value to allow re-importing the same file
    input.value = '';
}

async function handleImportPlayers(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
        alert('No file selected.');
        return;
    }

    if (file.type !== 'text/csv') {
        alert('Please upload a CSV file.');
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
            alert('Failed to read file.');
            return;
        }

        const lines = text.trim().split('\n');
        if (lines.length <= 1) {
            alert('CSV file is empty or only contains headers.');
            return;
        }

        const newPlayers: Player[] = [];
        const existingPlayerNames = new Set(players.map(p => p.name.toLowerCase()));

        for (let i = 1; i < lines.length; i++) { // Skip header row
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            const playerName = parts[0].trim();
            const initialEloString = parts[1] ? parts[1].trim() : '';
            const initialElo = initialEloString ? parseInt(initialEloString, 10) : INITIAL_ELO;

            if (!playerName) {
                console.warn(`Skipping row with empty player name: ${line}`);
                continue;
            }
            if (isNaN(initialElo) || initialElo < 0) {
                console.warn(`Skipping row with invalid ELO '${initialEloString}': ${line}`);
                continue;
            }

            if (!existingPlayerNames.has(playerName.toLowerCase())) {
                newPlayers.push({
                    id: generateUUID(),
                    name: playerName,
                    elo: initialElo,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    previousRank: 0,
                    currentStreakType: null, // New: Initialize streak
                    currentStreakLength: 0,  // New: Initialize streak
                });
                existingPlayerNames.add(playerName.toLowerCase()); // Add to set to prevent duplicates from within the CSV
            } else {
                console.warn(`Skipping existing player: ${playerName}`);
            }
        }

        if (newPlayers.length > 0) {
            players.push(...newPlayers);
            // Re-calculate previous ranks for all players after import
            const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
            players.forEach(p => {
                const sortedIndex = sortedPlayers.findIndex(sp => sp.id === p.id);
                if (sortedIndex !== -1) {
                    p.previousRank = sortedIndex + 1;
                }
            });
            // After updating players and ranks, recalculate streaks
            calculatePlayerStreaks();
            console.log('handleImportPlayers: Players state before render:', players);
            render(); // Re-render leaderboard and podium, and save state
            alert(`Successfully imported ${newPlayers.length} new players.`);
        } else {
            alert('No new players to import or all players already exist.');
        }
    };

    reader.onerror = () => {
        alert('Error reading file.');
    };

    reader.readAsText(file);

    // Clear file input value to allow re-importing the same file
    input.value = '';
}

function handleClearMatchHistory() {
    if (confirm('Are you sure you want to clear all match history? This action cannot be undone.')) {
        matchHistory = [];
        // Reset all player stats and ELOs to initial state
        players.forEach(player => {
            player.elo = INITIAL_ELO;
            player.wins = 0;
            player.losses = 0;
            player.draws = 0;
            player.previousRank = 0; // Reset previous rank for a fresh start
            player.currentStreakType = null; // New: Reset streak
            player.currentStreakLength = 0; // New: Reset streak
        });
        updateKFactorInputState(); // K-factor might become editable again
        render(); // This will also save the state
        alert('Match history cleared and player stats reset.');
    }
}

function handleClearPlayers() {
    if (confirm('Are you sure you want to clear ALL players and match history? This action cannot be undone.')) {
        players = [];
        matchHistory = []; // Clear matches too as they depend on players
        // Reset K-factor input state as there are no matches, so it should be editable.
        kFactor = DEFAULT_K_FACTOR; 
        if (DOMElements.kFactorInput) {
            DOMElements.kFactorInput.value = kFactor.toString();
        }
        updateKFactorInputState();
        // New: Reset streaks for all players (even though players array is cleared, good practice)
        players.forEach(p => {
            p.currentStreakType = null;
            p.currentStreakLength = 0;
        });
        render(); // This will also save the state
        alert('All players and match history cleared.');
    }
}

// --- Autocomplete Logic ---
function hideSuggestions(container: HTMLElement | null) {
    if (container) {
        container.innerHTML = '';
    }
}

function showSuggestions(filteredPlayers: Player[], suggestionsContainer: HTMLElement, textInput: HTMLInputElement, idInput: HTMLInputElement) {
    hideSuggestions(suggestionsContainer);
    if (filteredPlayers.length === 0) {
        suggestionsContainer.innerHTML = `<div class="suggestion-item-none">No matching players</div>`;
        return;
    }
    
    filteredPlayers.forEach(player => {
        const item = document.createElement('div');
        item.classList.add('suggestion-item');
        item.innerHTML = `<span>${player.name}</span> <small>${player.elo} ELO</small>`;
        
        item.addEventListener('mousedown', (e) => { // Mousedown to fire before input blur
            e.preventDefault();
            textInput.value = player.name;
            idInput.value = player.id;
            hideSuggestions(suggestionsContainer);
            updateWinnerLabels();
        });
        
        suggestionsContainer.appendChild(item);
    });
}

function handleAutocompleteInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let suggestionsContainer: HTMLElement | null, idInput: HTMLInputElement | null, otherPlayerId: string | undefined;

    if (input.id === 'player1-input') {
        suggestionsContainer = DOMElements.player1Suggestions;
        idInput = DOMElements.player1IdInput;
        otherPlayerId = DOMElements.player2IdInput?.value;
    } else {
        suggestionsContainer = DOMElements.player2Suggestions;
        idInput = DOMElements.player2IdInput;
        otherPlayerId = DOMElements.player1IdInput?.value;
    }

    if (!suggestionsContainer || !idInput) return;
    
    idInput.value = ''; // Clear old selection when user types
    const filterText = input.value.toLowerCase().trim();
    
    updateWinnerLabels();

    if (filterText.length === 0) {
        hideSuggestions(suggestionsContainer);
        return;
    }

    const filteredPlayers = players.filter(p => 
        p.name.toLowerCase().includes(filterText) && p.id !== otherPlayerId
    );
    
    showSuggestions(filteredPlayers, suggestionsContainer, input, idInput);
}

// --- INITIALIZATION ---
function main() {
  queryDOMElements();
  loadState();
  toggleUpdateModeUI();
  updateKFactorInputState();

  // --- Event Listeners ---
  DOMElements.settingsForm?.addEventListener('submit', (e) => e.preventDefault());
  DOMElements.addPlayerForm?.addEventListener('submit', handleAddPlayer);
  DOMElements.recordMatchForm?.addEventListener('submit', handleRecordMatch);
  DOMElements.kFactorInput?.addEventListener('input', handleKFactorChange);
  DOMElements.realtimeUpdateToggle?.addEventListener('change', handleRealtimeUpdateToggle);
  DOMElements.updateLeaderboardBtn?.addEventListener('click', handleUpdateLeaderboardClick);
  DOMElements.exportPlayersBtn?.addEventListener('click', handleExportPlayers);
  DOMElements.exportMatchesBtn?.addEventListener('click', handleExportMatches);

  // New: Import Matches Listener
  DOMElements.importMatchesFile?.addEventListener('change', handleImportMatches);

  // New: Import Players Listener
  DOMElements.importPlayersFile?.addEventListener('change', handleImportPlayers);

  // New: Clear History and Clear Players Listeners
  DOMElements.clearHistoryBtn?.addEventListener('click', handleClearMatchHistory);
  DOMElements.clearPlayersBtn?.addEventListener('click', handleClearPlayers);

  // Autocomplete Listeners
  DOMElements.player1Input?.addEventListener('input', handleAutocompleteInput);
  DOMElements.player2Input?.addEventListener('input', handleAutocompleteInput);
  
  // Hide suggestions if user clicks away from the form
  document.addEventListener('click', (event) => {
    if (DOMElements.recordMatchForm && !DOMElements.recordMatchForm.contains(event.target as Node)) {
        hideSuggestions(DOMElements.player1Suggestions);
        hideSuggestions(DOMElements.player2Suggestions);
    }
  });

  // Battle history toggle
  DOMElements.toggleBattleHistoryBtn?.addEventListener('click', () => {
    if (!DOMElements.battleHistoryContainer) return;
    const isOpen = !DOMElements.battleHistoryContainer.hasAttribute('hidden');
    if (isOpen) {
        DOMElements.battleHistoryContainer.setAttribute('hidden', 'true');
        DOMElements.toggleBattleHistoryBtn!.setAttribute('aria-expanded', 'false');
        DOMElements.toggleBattleHistoryBtn!.textContent = 'Show Battle History';
    } else {
        DOMElements.battleHistoryContainer.removeAttribute('hidden');
        DOMElements.toggleBattleHistoryBtn!.setAttribute('aria-expanded', 'true');
        DOMElements.toggleBattleHistoryBtn!.textContent = 'Hide Battle History';
        renderBattleHistory();
    }
  });

  render();
}

// Wait for the DOM to be fully loaded before running the main script
document.addEventListener('DOMContentLoaded', main);

function calculatePlayerStreaks() {
    players.forEach(player => {
        let streakType: 'W' | 'L' | null = null;
        let streakLength = 0;
        
        // Filter matches involving the current player, and sort by timestamp descending
        const playerMatches = matchHistory
            .filter(m => m.player1Id === player.id || m.player2Id === player.id)
            .sort((a, b) => b.timestamp - a.timestamp);

        for (const match of playerMatches) {
            const isPlayer1 = match.player1Id === player.id;
            let outcomeForPlayer: 'W' | 'L' | 'D' | null = null;

            if (isPlayer1) {
                if (match.outcome === 'p1') outcomeForPlayer = 'W';
                else if (match.outcome === 'p2') outcomeForPlayer = 'L';
                else outcomeForPlayer = 'D';
            } else { // Player 2
                if (match.outcome === 'p2') outcomeForPlayer = 'W';
                else if (match.outcome === 'p1') outcomeForPlayer = 'L';
                else outcomeForPlayer = 'D';
            }

            if (outcomeForPlayer === 'D') {
                // Draws break current streak, but don't count as win/loss for a new streak
                break;
            }

            if (!streakType) {
                // First win or loss establishes the streak type
                streakType = outcomeForPlayer;
                streakLength = 1;
            } else if (streakType === outcomeForPlayer) {
                // Continue the streak
                streakLength++;
            } else {
                // Streak broken (changed from W to L, or L to W)
                break;
            }
        }
        player.currentStreakType = streakType;
        player.currentStreakLength = streakLength;
    });
}

function renderStreak(type: 'W' | 'L' | null, length: number): string {
    if (length < 3 || !type) return '';

    let emoji = '';
    if (type === 'W') {
        emoji = '🔥'.repeat(Math.floor(length / 3));
    } else {
        emoji = '🧊'.repeat(Math.floor(length / 3));
    }
    
    return `<span class="streak-indicator">${emoji} ${type}${length}</span>`;
}
