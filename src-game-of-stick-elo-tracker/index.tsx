/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateElo } from './utils/eloCalculator';
import { Player, Match } from './types/appTypes';
import { INITIAL_ELO, DEFAULT_K_FACTOR } from './constants/appConstants';
import { saveAppState, loadAppState } from './utils/localStoragePersistence';
import { AppDOMElements, queryDOMElements } from './utils/domElements';
import { renderLeaderboard } from './renderers/leaderboard';
import { renderPodium } from './renderers/podium';
import { renderBattleHistory } from './renderers/battleHistory';
import { renderCombatMatrix } from './renderers/combatMatrix';

// New Imports
import { store } from './state/store';
import { renderProfileStatsSection } from './renderers/profileStats';
import { calculatePlayerStreaks } from './utils/statsUtils';
import { generateUUID } from './utils/uuid';
import { deduceKFromFirstMatch } from './utils/importUtils'; // Used in deduceK logic inside handlers, but if we moved logic to handlers, maybe not needed here? 
// actually deduceKFromFirstMatch IS needed if we use it here... checking... 
// Ah, the original code had `deduceKFromFirstMatch` used in `handleImportMatches`. 
// Since `handleImportMatches` is now in handlers, we don't need it here unless we use it for something else.
// Checking original code: it was ONLY used in `handleImportMatches`. So I can remove it from here.

import {
    handleExportPlayers,
    handleExportMatches,
    createImportMatchesHandler,
    createImportPlayersHandler
} from './handlers/importExportHandlers';

// --- DOM ELEMENTS ---
let DOMElements: AppDOMElements; // Global declaration

// --- UI UPDATE ---

function updateKFactorInputState() {
    const { kFactorInput } = DOMElements;
    if (!kFactorInput) return;

    const kFactorFormGroup = kFactorInput.closest('.form-group');
    if (!kFactorFormGroup) return;

    if (store.matchHistory.length > 0) {
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
    renderLeaderboard(store.players, DOMElements, store.matchHistory, store.lastLeaderboardElo);
    renderPodium(store.players, DOMElements);
    renderBattleHistory(store.matchHistory, DOMElements);
    renderCombatMatrix(store.players, store.matchHistory, DOMElements);
    renderProfileStatsSection(store.players, store.matchHistory);

    // Now that ranks are updated (including previousRank), save the state.
    saveAppState({
        players: store.players,
        matchHistory: store.matchHistory,
        kFactor: store.kFactor,
        isRealtimeUpdate: store.isRealtimeUpdate
    });
}

function updateLeaderboardDiffs() {
    // Save current ELOs for all players
    store.lastLeaderboardElo = {};
    store.players.forEach(p => {
        store.lastLeaderboardElo[p.id] = p.elo;
    });
}

function handleUpdateLeaderboardClick() {
    // First render the leaderboard to display the cumulative ELO changes since the previous update,
    // then refresh the baseline so the next diff will start from the freshly-rendered values.
    render();
    updateLeaderboardDiffs();
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

    if (store.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
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
        store.players.push(newPlayer);

        // Persist state and update UI immediately
        saveAppState({
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor,
            isRealtimeUpdate: store.isRealtimeUpdate
        });
        render(); // Update all UI components including profile stats

        if (DOMElements.newPlayerNameInput) DOMElements.newPlayerNameInput.value = '';
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

    const player1 = store.players.find(p => p.id === p1Id);
    const player2 = store.players.find(p => p.id === p2Id);

    if (!player1 || !player2) {
        if (DOMElements.matchError) DOMElements.matchError.textContent = 'One or more players not found.';
        return;
    }

    const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, winner, store.kFactor);

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
    store.matchHistory.push(newMatch);

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
    calculatePlayerStreaks(store.players, store.matchHistory);

    updateKFactorInputState();

    // Persist state; user will update leaderboard manually.
    saveAppState({
        players: store.players,
        matchHistory: store.matchHistory,
        kFactor: store.kFactor,
        isRealtimeUpdate: store.isRealtimeUpdate
    });

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
        store.kFactor = value;
        saveAppState({
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor,
            isRealtimeUpdate: store.isRealtimeUpdate
        });
    }
}

function handleClearMatchHistory() {
    if (confirm('Are you sure you want to clear all match history? This action cannot be undone.')) {
        store.matchHistory = [];
        // Reset all player stats and ELOs to initial state
        store.players.forEach(player => {
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
        store.players = [];
        store.matchHistory = []; // Clear matches too as they depend on players
        // Reset K-factor input state as there are no matches, so it should be editable.
        store.kFactor = DEFAULT_K_FACTOR;
        if (DOMElements.kFactorInput) {
            DOMElements.kFactorInput.value = store.kFactor.toString();
        }
        updateKFactorInputState();
        // New: Reset streaks for all players (even though players array is cleared, good practice)
        store.players.forEach(p => {
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

    const filteredPlayers = store.players.filter(p =>
        p.name.toLowerCase().includes(filterText) && p.id !== otherPlayerId
    );

    showSuggestions(filteredPlayers, suggestionsContainer, input, idInput);
}

// --- INITIALIZATION ---
function main() {
    DOMElements = queryDOMElements(); // Assign to global DOMElements
    const { players: loadedPlayers, matchHistory: loadedMatchHistory, kFactor: loadedKFactor } = loadAppState();

    // Initialize store
    store.players = loadedPlayers;
    store.matchHistory = loadedMatchHistory;
    store.kFactor = loadedKFactor;
    store.isRealtimeUpdate = true; // Realtime feature removed – always update instantly

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
    DOMElements.updateLeaderboardBtn?.addEventListener('click', handleUpdateLeaderboardClick);
    // Realtime toggle & manual update button removed

    // Use new handlers
    DOMElements.exportPlayersBtn?.addEventListener('click', handleExportPlayers);
    DOMElements.exportMatchesBtn?.addEventListener('click', handleExportMatches);

    // New: Import Matches Listener - using factory pattern
    if (DOMElements.importMatchesFile) {
        const context = { render, updateKFactorInputState, DOMElements };
        DOMElements.importMatchesFile.addEventListener('change', createImportMatchesHandler(context));
    }

    // New: Import Players Listener - using factory pattern
    if (DOMElements.importPlayersFile) {
        const context = { render, updateKFactorInputState, DOMElements };
        DOMElements.importPlayersFile.addEventListener('change', createImportPlayersHandler(context));
    }

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
            renderBattleHistory(store.matchHistory, DOMElements);
        }
    });

    render();
}

// Wait for the DOM to be fully loaded before running the main script
document.addEventListener('DOMContentLoaded', main);
