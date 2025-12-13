/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateElo } from './utils/eloCalculator';
import { Player, Match } from './types/appTypes';
import { INITIAL_ELO, DEFAULT_K_FACTOR } from './constants/appConstants';
import { getSessionList, createSession, loadSession, saveSession, migrateLegacyDataIfNeeded } from './utils/localStoragePersistence';
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

// --- PERSISTENCE HELPER ---
function persist() {
    if (store.currentSessionId) {
        saveSession(store.currentSessionId, {
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor
        });
    }
}

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
    renderRosterList();

    // Now that ranks are updated (including previousRank), save the state.
    // persist() is called by the caller functions usually, but render() is sometimes called for refresh.
    // However, saving state here might be redundant if we persist on mutation.
    // Given legacy code, we keep it safe or remove it? Use persist() if needed.
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

function renderRosterList() {
    if (!DOMElements.rosterList) return;
    DOMElements.rosterList.innerHTML = '';

    // Sort alphabetically
    const sorted = [...store.players].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.innerHTML = `<span>${p.name}</span> <span class="elo">${p.elo}</span>`;
        DOMElements.rosterList?.appendChild(chip);
    });
}

function handleAddPlayer(event: SubmitEvent) {
    event.preventDefault();
    const nameInput = DOMElements.newPlayerNameInput;
    const name = nameInput?.value.trim();

    if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = '';

    if (!name) {
        showNotification('Player name cannot be empty', 'error');
        return;
    }

    if (store.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`Player "${name}" already exists!`, 'error');
        // Optional: clear input if duplicate? Keep it so user can edit.
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
        persist();
        render(); // Update all UI components including profile stats

        showNotification(`Player "${name}" added!`, 'success');

        if (nameInput) nameInput.value = '';
    }
}

// --- NOTIFICATIONS ---
function showNotification(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('app-notification');
    if (!toast) return;

    // Reset classes and force reflow to restart animation if clicked rapidly
    toast.className = 'notification-toast';
    void toast.offsetWidth;

    toast.textContent = message;
    toast.classList.add('show', type);

    // Wait 1.5s then start vanishing
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hiding');

        // After hiding animation (1s), reset fully
        setTimeout(() => {
            toast.classList.remove('hiding', 'success', 'error');
        }, 1000);
    }, 1500);
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

    persist();

    // Prepare Notification Message
    let msg = '';
    if (winner === 'p1') {
        msg = `${player1.name} won against ${player2.name}`;
    } else if (winner === 'p2') {
        msg = `${player2.name} won against ${player1.name}`;
    } else {
        msg = `Draw between ${player1.name} and ${player2.name}`;
    }
    showNotification(msg, 'success');

    // Reset Form
    form.reset();

    // Explicitly clear specific elements
    if (DOMElements.player1Input) DOMElements.player1Input.value = '';
    if (DOMElements.player2Input) DOMElements.player2Input.value = '';
    if (DOMElements.player1IdInput) DOMElements.player1IdInput.value = '';
    if (DOMElements.player2IdInput) DOMElements.player2IdInput.value = '';

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
        item.dataset.id = player.id; // Store ID
        item.dataset.name = player.name; // Store Name
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

// --- MENU & ROUTING ---


function renderGameMenu() {
    migrateLegacyDataIfNeeded();
    const sessions = getSessionList();

    document.getElementById('game-menu')!.style.display = 'flex';
    document.getElementById('app-main')!.style.display = 'none';

    const list = document.getElementById('session-list')!;
    list.innerHTML = '';

    if (sessions.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1rem;">No previous operations found.</div>';
    } else {
        sessions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'session-item';
            const date = new Date(s.lastPlayed).toLocaleDateString();
            card.innerHTML = `
                <div class="session-info">
                    <h3>${s.name}</h3>
                    <div class="session-meta">${s.playerCount} Players • Last Played: ${date}</div>
                </div>
                <div class="session-arrow">➜</div>
            `;
            card.onclick = () => {
                window.location.hash = `game_${s.id}`;
                window.location.reload();
            };
            list.appendChild(card);
        });
    }

    const form = document.getElementById('new-session-form') as HTMLFormElement;
    form.onsubmit = (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-session-name') as HTMLInputElement;
        const kInput = document.getElementById('new-session-k') as HTMLInputElement;

        if (nameInput.value) {
            const id = createSession(nameInput.value, parseInt(kInput.value) || 60);
            window.location.hash = `game_${id}`;
            window.location.reload();
        }
    };
}

function loadSessionFromHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#game_')) return false;

    const id = hash.replace('#game_', '');
    const state = loadSession(id);

    if (state) {
        store.currentSessionId = id;
        store.players = state.players;
        store.matchHistory = state.matchHistory;
        store.kFactor = state.kFactor;

        document.getElementById('game-menu')!.style.display = 'none';
        document.getElementById('app-main')!.style.display = 'block';
        return true;
    }
    return false;
}

function syncSession() {
    if (!store.currentSessionId) return;
    const state = loadSession(store.currentSessionId);
    if (state) {
        store.players = state.players;
        store.matchHistory = state.matchHistory;
        store.kFactor = state.kFactor;
        updateKFactorInputState();
        render();
    }
}

// --- NAVIGATION ---
function switchView(viewId: string) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');

    const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
    if (btn) btn.classList.add('active');
}

function handleExit() {
    window.location.hash = '';
    window.location.reload();
}

// --- MAIN ---
function main() {
    DOMElements = queryDOMElements();

    // Navigation Listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.classList.contains('nav-exit')) return;
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    const exitBtn = document.getElementById('nav-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', handleExit);

    // Sync across tabs
    window.addEventListener('storage', (e) => {
        if (store.currentSessionId && e.key === `session_${store.currentSessionId}`) {
            syncSession();
        }
        if (!store.currentSessionId && e.key === 'game-of-stick-sessions') {
            renderGameMenu();
        }
    });

    if (loadSessionFromHash()) {
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

        DOMElements.exportPlayersBtn?.addEventListener('click', handleExportPlayers);
        DOMElements.exportMatchesBtn?.addEventListener('click', handleExportMatches);

        if (DOMElements.importMatchesFile) {
            const context = { render, updateKFactorInputState, DOMElements };
            DOMElements.importMatchesFile.addEventListener('change', createImportMatchesHandler(context));
        }

        if (DOMElements.importPlayersFile) {
            const context = { render, updateKFactorInputState, DOMElements };
            DOMElements.importPlayersFile.addEventListener('change', createImportPlayersHandler(context));
        }

        DOMElements.clearHistoryBtn?.addEventListener('click', handleClearMatchHistory);
        DOMElements.clearPlayersBtn?.addEventListener('click', handleClearPlayers);

        DOMElements.player1Input?.addEventListener('input', handleAutocompleteInput);
        DOMElements.player2Input?.addEventListener('input', handleAutocompleteInput);

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                const input = event.target as HTMLInputElement;
                let suggestionsContainer: HTMLElement | null, idInput: HTMLInputElement | null;

                if (input.id === 'player1-input') {
                    suggestionsContainer = DOMElements.player1Suggestions;
                    idInput = DOMElements.player1IdInput;
                } else if (input.id === 'player2-input') {
                    suggestionsContainer = DOMElements.player2Suggestions;
                    idInput = DOMElements.player2IdInput;
                } else {
                    return;
                }

                if (suggestionsContainer && suggestionsContainer.children.length > 0) {
                    const firstItem = suggestionsContainer.firstElementChild as HTMLElement;
                    if (firstItem && !firstItem.classList.contains('suggestion-item-none')) {
                        const name = firstItem.dataset.name;
                        const id = firstItem.dataset.id;

                        if (name && id && idInput) {
                            input.value = name;
                            idInput.value = id;
                            hideSuggestions(suggestionsContainer);
                            updateWinnerLabels();
                        }
                    }
                }
            }
        };

        DOMElements.player1Input?.addEventListener('keydown', handleKeydown);
        DOMElements.player2Input?.addEventListener('keydown', handleKeydown);

        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            // Handle clicking outside suggestions
            if (DOMElements.recordMatchForm && !DOMElements.recordMatchForm.contains(target)) {
                hideSuggestions(DOMElements.player1Suggestions);
                hideSuggestions(DOMElements.player2Suggestions);
            }
            // Handle Empty Leaderboard Link
            if (target && target.id === 'empty-leaderboard-link') {
                event.preventDefault();
                switchView('view-roster');
            }
        });

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
    } else {
        renderGameMenu();
    }
}

// Wait for the DOM to be fully loaded before running the main script
document.addEventListener('DOMContentLoaded', main);
