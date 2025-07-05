/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateElo } from './utils/eloCalculator';
import { Player, Match } from './types/appTypes';
import { INITIAL_ELO, PLAYERS_STORAGE_KEY, MATCH_HISTORY_STORAGE_KEY, SETTINGS_STORAGE_KEY, DEFAULT_K_FACTOR } from './constants/appConstants';
import { saveAppState, loadAppState } from './utils/localStoragePersistence';
import { AppDOMElements, queryDOMElements } from './utils/domElements';
import { renderLeaderboard } from './renderers/leaderboard';
import { renderPodium } from './renderers/podium';
import { renderBattleHistory } from './renderers/battleHistory';
import { renderCombatMatrix } from './renderers/combatMatrix';

// --- TYPE DEFINITIONS ---

// --- STATE ---
let players: Player[] = [];
let matchHistory: Match[] = [];
let kFactor: number = DEFAULT_K_FACTOR;
let isRealtimeUpdate: boolean = true;
let lastLeaderboardElo: Record<string, number> = {};

// --- DOM ELEMENTS ---
let DOMElements: AppDOMElements; // Global declaration

// --- DATA PERSISTENCE ---

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

function render() {
  // Do NOT update lastLeaderboardElo here!
  renderLeaderboard(players, DOMElements, matchHistory, lastLeaderboardElo);
  renderPodium(players, DOMElements);
  renderBattleHistory(matchHistory, DOMElements);
  renderCombatMatrix(players, matchHistory, DOMElements);
  renderProfileStatsSection(players, matchHistory);
  // Now that ranks are updated (including previousRank), save the state.
  saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate });
}

function updateLeaderboardDiffs() {
  // Save current ELOs for all players
  lastLeaderboardElo = {};
  players.forEach(p => {
    lastLeaderboardElo[p.id] = p.elo;
  });
}

function handleUpdateLeaderboardClick() {
  updateLeaderboardDiffs();
  render();
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
        saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate });
    }

    if(DOMElements.newPlayerNameInput) DOMElements.newPlayerNameInput.value = '';
  }
}

function deduceKFromFirstMatch(parts: string[]): number | null {
    // parts: [Timestamp, Player 1, Player 2, Outcome, P1 ELO Before, P1 ELO After, P2 ELO Before, P2 ELO After]
    const p1EloBefore = parseFloat(parts[4]);
    const p1EloAfter = parseFloat(parts[5]);
    const p2EloBefore = parseFloat(parts[6]);
    const p2EloAfter = parseFloat(parts[7]);
    const outcomeText = parts[3].trim();
    let outcome: 'p1' | 'p2' | 'draw';
    if (outcomeText.includes(parts[1]) && outcomeText.includes('Won')) outcome = 'p1';
    else if (outcomeText.includes(parts[2]) && outcomeText.includes('Won')) outcome = 'p2';
    else if (outcomeText === 'Draw') outcome = 'draw';
    else return null;
    // ELO formula
    const expectedScoreP1 = 1 / (1 + 10 ** ((p2EloBefore - p1EloBefore) / 400));
    let actualScoreP1: number;
    if (outcome === 'p1') actualScoreP1 = 1;
    else if (outcome === 'p2') actualScoreP1 = 0;
    else actualScoreP1 = 0.5;
    const delta = p1EloAfter - p1EloBefore;
    const denominator = actualScoreP1 - expectedScoreP1;
    if (Math.abs(denominator) < 1e-6) return null; // Avoid division by zero
    const k = delta / denominator;
    return Math.round(k);
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

  const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, winner, kFactor);
  
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
    saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate });
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
        saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate });
    }
}

function handleRealtimeUpdateToggle(event: Event) {
    const target = event.target as HTMLInputElement;
    isRealtimeUpdate = target.checked;
    // If user toggles it on, refresh the leaderboard immediately.
    if (isRealtimeUpdate) {
        render();
    } else {
        saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate });
    }
    toggleUpdateModeUI();
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
        if (match.outcome === 'p1') outcomeText = `${match.player1Name} Won`;
        if (match.outcome === 'p2') outcomeText = `${match.player2Name} Won`;

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

        // Deduce K from first match
        const firstParts = lines[1].split(',');
        let detectedK = deduceKFromFirstMatch(firstParts);
        if (detectedK && detectedK > 0) {
            kFactor = detectedK;
            if (DOMElements.kFactorInput) DOMElements.kFactorInput.value = String(kFactor);
            alert(`K détecté automatiquement à l'import : K = ${kFactor}`);
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

            const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, outcome, kFactor);
            
            const newMatch: Match = {
                id: generateUUID(),
                timestamp: (() => {
                  const iso = parts[0]?.trim();
                  const parsed = iso ? Date.parse(iso) : NaN;
                  return isNaN(parsed) ? Date.now() : parsed;
                })(),
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

        // After render, set profile stats dropdown to first player and render their stats
        setTimeout(() => {
          const select = document.getElementById('profile-stats-select') as HTMLSelectElement | null;
          if (select && players.length > 0) {
            select.value = players[0].id;
            renderProfileStatsContent(players[0].id, players, matchHistory);
          }
        }, 0);
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
                    lastEloChange: 0, // Reset ELO change
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
                p.lastEloChange = 0; // Reset ELO change for all players after import
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
            player.lastEloChange = 0; // Reset ELO change
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
            p.lastEloChange = 0;
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
  DOMElements = queryDOMElements(); // Assign to global DOMElements
  const { players: loadedPlayers, matchHistory: loadedMatchHistory, kFactor: loadedKFactor, isRealtimeUpdate: loadedIsRealtimeUpdate } = loadAppState();
  players = loadedPlayers;
  matchHistory = loadedMatchHistory;
  kFactor = loadedKFactor;
  isRealtimeUpdate = loadedIsRealtimeUpdate;
  toggleUpdateModeUI();
  updateKFactorInputState();

  // Extra safety: Always hide modal and clear content on load
  if (DOMElements.playerCardModal) {
    DOMElements.playerCardModal.setAttribute('hidden', 'true');
    const contentDiv = document.getElementById('player-card-content');
    if (contentDiv) contentDiv.innerHTML = '';
  }

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
        renderBattleHistory(matchHistory, DOMElements);
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

function renderProfileStatsSection(players: Player[], matchHistory: Match[]) {
  // Move the toggle button outside the section
  let section = document.getElementById('profile-stats-section');
  if (!section) return;

  // Remove any existing external toggle button
  let externalToggleBtn = document.getElementById('profile-stats-toggle-btn') as HTMLButtonElement | null;
  if (externalToggleBtn) externalToggleBtn.remove();

  // Create and insert the toggle button before the section
  externalToggleBtn = document.createElement('button');
  externalToggleBtn.id = 'profile-stats-toggle-btn';
  externalToggleBtn.className = 'button-secondary profile-toggle-btn';
  externalToggleBtn.textContent = section.style.display === 'none' ? 'Show Profile Stats' : 'Hide Profile Stats';
  section.parentNode?.insertBefore(externalToggleBtn, section);
  externalToggleBtn.addEventListener('click', () => {
    if (section.style.display === 'none') {
      section.style.display = '';
      externalToggleBtn.textContent = 'Hide Profile Stats';
    } else {
      section.style.display = 'none';
      externalToggleBtn.textContent = 'Show Profile Stats';
    }
  });

  // Player select
  let select = document.getElementById('profile-stats-select') as HTMLSelectElement | null;
  if (!select) {
    select = document.createElement('select');
    select.id = 'profile-stats-select';
    section.insertBefore(select, section.querySelector('h2')?.nextSibling ?? section.firstChild);
    if (select) {
      select.addEventListener('change', () => {
        renderProfileStatsContent(select!.value, players, matchHistory);
      });
    }
  }
  // Populate options
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = '';
  sortedPlayers.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    select.appendChild(option);
  });
  // Guarantee valid selection
  let selectedId = select.value;
  if (!sortedPlayers.find(p => p.id === selectedId) && sortedPlayers.length > 0) {
    select.value = sortedPlayers[0].id;
    selectedId = sortedPlayers[0].id;
  }
  // Render content for selected player
  if (sortedPlayers.length > 0) {
    renderProfileStatsContent(selectedId, players, matchHistory);
  } else {
    const content = document.getElementById('profile-stats-content');
    if (content) content.innerHTML = '<p>No players.</p>';
  }
}

function renderProfileStatsContent(playerId: string, players: Player[], matchHistory: Match[]) {
  const content = document.getElementById('profile-stats-content');
  if (!content) return;
  const player = players.find(p => p.id === playerId);
  if (!player) {
    content.innerHTML = '<p>No player selected.</p>';
    return;
  }
  
  // Get ELO evolution data
  const playerMatches = matchHistory
    .filter(m => m.player1Id === player.id || m.player2Id === player.id)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let currentElo = INITIAL_ELO;
  const eloHistory = [currentElo];
  
  playerMatches.forEach(match => {
    const isP1 = match.player1Id === player.id;
    if (isP1) {
      currentElo = match.player1EloAfter;
    } else {
      currentElo = match.player2EloAfter;
    }
    eloHistory.push(currentElo);
  });
  
  // Create SVG graph
  const svgWidth = 120;
  const svgHeight = 40;
  const padding = 4;
  const graphWidth = svgWidth - 2 * padding;
  const graphHeight = svgHeight - 2 * padding;
  
  let svgPath = '';
  if (eloHistory.length > 1) {
    const minElo = Math.min(...eloHistory);
    const maxElo = Math.max(...eloHistory);
    const eloRange = maxElo - minElo || 1;
    
    const points = eloHistory.map((elo, index) => {
      const x = padding + (index / (eloHistory.length - 1)) * graphWidth;
      const y = padding + graphHeight - ((elo - minElo) / eloRange) * graphHeight;
      return `${x},${y}`;
    });
    
    svgPath = `M ${points.join(' L ')}`;
  } else {
    // Single point - draw a horizontal line
    svgPath = `M ${padding},${svgHeight/2} L ${svgWidth-padding},${svgHeight/2}`;
  }
  
  // Calculate best win streak
  let bestWinStreak = 0;
  let currentStreak = 0;
  matchHistory
    .filter(m => m.player1Id === player.id || m.player2Id === player.id)
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(match => {
      const isP1 = match.player1Id === player.id;
      let win = false;
      if ((isP1 && match.outcome === 'p1') || (!isP1 && match.outcome === 'p2')) win = true;
      if (win) {
        currentStreak++;
        if (currentStreak > bestWinStreak) bestWinStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });
  // Get player rank
  const sortedByElo = [...players].sort((a, b) => b.elo - a.elo);
  const rank = sortedByElo.findIndex(p => p.id === player.id) + 1;
  // Stats (one line) with graph
  let html = `<div style="margin-bottom:1em;font-size:1.1em;display:flex;align-items:center;gap:1rem;">
    <div><span style='color:#888;'>#${rank}</span> <strong>${player.name}</strong> &nbsp; ELO: <strong>${player.elo}</strong> &nbsp; <span class='elo-up'>Wins: <strong>${player.wins}</strong></span> | <span class='elo-down'>Losses: <strong>${player.losses}</strong></span> | Draws: <strong>${player.draws}</strong> | <span style='color:var(--rank-up-color);'>Best Win Streak: <span title='Best Win Streak'>🔥${bestWinStreak}</span></span></div>
    <svg width="${svgWidth}" height="${svgHeight}" style="flex-shrink:0;">
      <path d="${svgPath}" stroke="#4CAF50" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;
  
  // Last battles
  const personalMatches = matchHistory.filter(m => m.player1Id === player.id || m.player2Id === player.id)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
  if (personalMatches.length > 0) {
    html += '<h4>Last Battles</h4><pre style="max-height:220px;overflow:auto;padding-left:0.5em;font-size:1em;">';
    personalMatches.forEach(match => {
      const isP1 = match.player1Id === player.id;
      const opponent = isP1 ? match.player2Name : match.player1Name;
      const result = match.outcome === 'draw' ? 'Draw' :
        (isP1 && match.outcome === 'p1') || (!isP1 && match.outcome === 'p2') ? 'Win' : 'Loss';
      const eloChange = isP1 ? match.player1EloChange : match.player2EloChange;
      const eloStr = (eloChange && eloChange > 0 ? '+' : '') + (eloChange || 0);
      // Odds calculation
      const p1EloBefore = match.player1EloBefore;
      const p2EloBefore = match.player2EloBefore;
      const expectedScore = 1 / (1 + Math.pow(10, ((p2EloBefore - p1EloBefore) / 400)));
      const odds = isP1 ? expectedScore : 1 - expectedScore;
      const oddsPercent = Math.round(odds * 100);
      // Odds comment
      let oddsComment = `odds: ${oddsPercent}%`;
      if (result === 'Win' && odds < 0.5) oddsComment += ' — Beat the odds!';
      // Date formatting (DD/MM HH:MM:SS)
      const d = new Date(match.timestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const dateStr = `${day}/${month} ${hours}:${minutes}:${seconds}`;
      // Color classes
      let resultClass = '';
      let eloClass = '';
      if (result === 'Win') resultClass = 'elo-up';
      else if (result === 'Loss') resultClass = 'elo-down';
      if (eloChange && eloChange > 0) eloClass = 'elo-up';
      else if (eloChange && eloChange < 0) eloClass = 'elo-down';
      html += `vs. ${opponent.padEnd(12)}\t— <span class="${resultClass}">${result.padEnd(4)}</span>\t(<span class="elo-change ${eloClass}">${eloStr}</span>)\t${dateStr}\t${oddsComment}\n`;
    });
    html += '</pre>';
  } else {
    html += '<p style="color:#aaa;">No battles yet.</p>';
  }
  content.innerHTML = html;
}
