/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { eloScoring } from './scoring';
import { Player, Match } from './types/appTypes';
import { DEFAULT_K_FACTOR } from './constants/appConstants';
import { loadSession, saveSession, getLastLibraryName, saveLastLibraryName, clearTemporaryData } from './utils/localStoragePersistence';
import { getExampleGameState, EXAMPLE_GAME_NAME } from './utils/exampleGameData';
import { AppDOMElements, queryDOMElements } from './utils/domElements';
import { renderLeaderboard } from './renderers/leaderboard';
import { renderPodium } from './renderers/podium';
import { renderBattleHistory } from './renderers/battleHistory';
import { renderCombatMatrix } from './renderers/combatMatrix';
import { selectLibraryFolder, listGamesInLibrary, createGameInLibrary, loadGameFromSession, saveGameToSession } from './utils/fileSystemPersistence';

// New Imports
import { store } from './state/store';
import { renderProfileStatsSection } from './renderers/profileStats';
import { calculatePlayerStreaks } from './utils/statsUtils';
import { generateUUID } from './utils/uuid';
import { getRemainingOpponents } from './utils/opponentTracker';
import { generateGamePDF } from './utils/pdfExport';

// --- BROADCAST CHANNEL FOR CROSS-WINDOW SYNC ---
const gameChannel = new BroadcastChannel('game-of-stick-sync');

// Listen for updates from other windows
gameChannel.onmessage = async (event) => {
    const { type, folderName } = event.data;

    // Only sync if we're viewing the same game
    if (type === 'game-updated' && store.folderName === folderName && store.directoryHandle) {
        console.log('Received sync message from another window, reloading...');
        try {
            // Save current previousRank values to show position changes
            const oldRanks: Record<string, number> = {};
            store.players.forEach(p => {
                oldRanks[p.id] = p.previousRank;
            });

            // Load new state from files
            const state = await loadGameFromSession(store.directoryHandle);

            // Merge: keep old previousRank for existing players to show deltas
            state.players.forEach(p => {
                if (oldRanks[p.id] !== undefined) {
                    p.previousRank = oldRanks[p.id];
                }
            });

            store.players = state.players;
            store.matchHistory = state.matchHistory;
            store.kFactor = state.kFactor;
            store.hasUnsavedChanges = false;

            // Keep local ELO baseline intact - shows cumulative diffs since this window's last Update

            // Recalculate streaks based on new match history
            calculatePlayerStreaks(store.players, store.matchHistory);

            updateKFactorInputState();
            updateSaveButton();

            // Render without saving (persist would mark as changed)
            renderLeaderboard(store.players, DOMElements, store.matchHistory, store.lastLeaderboardElo);
            renderPodium(store.players, DOMElements);
            renderBattleHistory(store.matchHistory, DOMElements);
            renderCombatMatrix(store.players, store.matchHistory, DOMElements);
            renderProfileStatsSection(store.players, store.matchHistory);
            renderRosterList();

            showNotification('Game synced from another window');
        } catch (e) {
            console.error('Failed to sync from other window:', e);
        }
    }
};

// Notify other windows when game is saved
function broadcastGameUpdate() {
    if (store.folderName) {
        gameChannel.postMessage({
            type: 'game-updated',
            folderName: store.folderName
        });
    }
}

// --- PERSISTENCE HELPER ---
function persist() {
    if (store.directoryHandle) {
        store.hasUnsavedChanges = true;
        updateSaveButton();
    } else if (store.currentSessionId) {
        saveSession(store.currentSessionId, {
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor
        });
    }
}

import {
    handleExportPlayers,
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
    persist();
}

function updateSaveButton() {
    const btn = document.getElementById('nav-save-btn');
    if (!btn) return;

    btn.style.display = 'inline-block'; // Always visible now

    if (store.directoryHandle) {
        if (store.hasUnsavedChanges) {
            btn.textContent = 'Save Game *';
            btn.classList.add('unsaved');
        } else {
            btn.textContent = 'Save Game';
            btn.classList.remove('unsaved');
        }
    } else {
        // Not saved to folder yet
        btn.textContent = 'Save to Folder';
        btn.classList.remove('unsaved');
    }

    updateStatusBar();
}

/**
 * Update the persistent status bar at the bottom of the screen
 */
function updateStatusBar() {
    const statusBar = document.getElementById('app-status-bar');
    const statusText = document.getElementById('status-bar-text');
    if (!statusBar || !statusText) return;

    // Check if we have a temporary notification showing (hacky check: class list)
    // Actually, simple approach: Just show the current state.
    // Notifications will overwrite this text momentarily if called after.

    if (store.directoryHandle && store.folderName) {
        // Show persistent game context
        statusBar.style.display = 'block';
        if (store.hasUnsavedChanges) {
            statusBar.classList.remove('saved');
            statusBar.classList.add('error'); // Use helpful color for attention
            statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> has unsaved changes.`;
        } else {
            statusBar.classList.remove('saved', 'error');
            // Neutral state
            statusText.innerHTML = `📂 Current Game: <strong>${store.folderName}</strong>`;
        }
    } else if (store.folderName) {
        // Memory only
        statusBar.style.display = 'block';
        statusBar.classList.remove('saved');
        statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> (Not saved to folder)`;
    } else {
        statusBar.style.display = 'none';
    }
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

function handleKFactorChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val > 0) {
        store.kFactor = val;
        persist();
    }
}

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
            elo: eloScoring.getInitialRating(),
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

    // Also update the persistent status bar with the message
    updateStatusBarMessage(message, type);

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

/**
 * Update the status bar with a message (persistent log)
 */
function updateStatusBarMessage(message: string, type: 'success' | 'error' = 'success') {
    const statusBar = document.getElementById('app-status-bar');
    const statusText = document.getElementById('status-bar-text');
    if (!statusBar || !statusText) return;

    statusBar.style.display = 'block';

    if (type === 'success') {
        statusBar.classList.add('saved');
        statusBar.classList.remove('error');
    } else {
        statusBar.classList.remove('saved');
        statusBar.classList.add('error');
    }

    statusText.innerHTML = message;
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

    const result = eloScoring.calculateNewRatings(player1.elo, player2.elo, winner, store.kFactor);
    const newP1Elo = result.newP1Rating;
    const newP2Elo = result.newP2Rating;

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

    // Update remaining opponents display
    renderRemainingOpponents();
}

/**
 * Render the remaining opponents card for the selected players
 */
function renderRemainingOpponents() {
    const card = document.getElementById('remaining-opponents-card');
    const p1Col = document.getElementById('p1-opponents-col');
    const p2Col = document.getElementById('p2-opponents-col');
    const p1Header = document.getElementById('p1-opponents-header');
    const p2Header = document.getElementById('p2-opponents-header');
    const p1List = document.getElementById('p1-opponents-list');
    const p2List = document.getElementById('p2-opponents-list');

    if (!card || !p1Col || !p2Col || !p1Header || !p2Header || !p1List || !p2List) return;

    const p1Id = DOMElements.player1IdInput?.value;
    const p2Id = DOMElements.player2IdInput?.value;

    // Hide card if no players selected
    if (!p1Id && !p2Id) {
        card.setAttribute('hidden', 'true');
        return;
    }

    card.removeAttribute('hidden');

    // Render Player 1 opponents
    if (p1Id) {
        const p1 = store.players.find(p => p.id === p1Id);
        p1Header.textContent = `${p1?.name || 'Player 1'} (Round ${getRemainingOpponents(p1Id, store.players, store.matchHistory).round})`;
        renderOpponentList(p1Id, p1List, p2Id);
        p1Col.style.display = 'block';
    } else {
        p1Col.style.display = 'none';
    }

    // Render Player 2 opponents
    if (p2Id) {
        const p2 = store.players.find(p => p.id === p2Id);
        p2Header.textContent = `${p2?.name || 'Player 2'} (Round ${getRemainingOpponents(p2Id, store.players, store.matchHistory).round})`;
        renderOpponentList(p2Id, p2List, p1Id);
        p2Col.style.display = 'block';
    } else {
        p2Col.style.display = 'none';
    }
}

/**
 * Render the opponent list for a single player
 */
function renderOpponentList(playerId: string, container: HTMLElement, otherId?: string) {
    const result = getRemainingOpponents(playerId, store.players, store.matchHistory);

    if (result.allFought) {
        container.innerHTML = '<div class="round-complete">✓ All fought this round!</div>';
        return;
    }

    container.innerHTML = result.opponents.map(opp => {
        const isOtherPlayer = opp.playerId === otherId;
        const countClass = opp.timesFought === 0 ? 'count never-fought' : 'count';
        return `
            <div class="opponent-item${isOtherPlayer ? ' selected-opponent' : ''}" data-id="${opp.playerId}">
                <span class="name">${opp.playerName}</span>
                <span class="${countClass}">${opp.timesFought}</span>
            </div>
        `;
    }).join('');
}

persist();

function handleClearMatchHistory() {
    if (confirm('Are you sure you want to clear all match history? This action cannot be undone.')) {
        store.matchHistory = [];
        // Reset all player stats and ELOs to initial state
        store.players.forEach(player => {
            player.elo = eloScoring.getInitialRating();
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

        item.addEventListener('pointerdown', (e) => { // pointerdown covers mouse and touch, fires before click/blur
            e.preventDefault();
            console.log('Suggestion ID selected:', player.id, player.name);
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



// --- GAME LIBRARY LOGIC ---

async function handleOpenLibrary() {
    try {
        const libraryHandle = await selectLibraryFolder();
        if (libraryHandle) {
            store.libraryHandle = libraryHandle;
            renderGameLibrary(libraryHandle);
        }
    } catch (e) {
        console.error(e);
        showNotification('Failed to open library', 'error');
    }
}

async function renderGameLibrary(libraryHandle: FileSystemDirectoryHandle) {
    const games = await listGamesInLibrary(libraryHandle);

    document.getElementById('game-menu')!.style.display = 'flex';
    document.getElementById('app-main')!.style.display = 'none';

    // Update Menu Header or Title to indicate Library Mode could be nice, but reusing current structure
    const list = document.getElementById('session-list')!;
    list.innerHTML = '';

    // Header for Library
    const libraryHeader = document.createElement('h3');
    libraryHeader.textContent = `Library: ${libraryHandle.name}`;
    libraryHeader.style.width = '100%';
    libraryHeader.style.textAlign = 'center';
    libraryHeader.style.color = 'var(--text-muted)';
    list.appendChild(libraryHeader);

    if (games.length === 0) {
        const msg = document.createElement('div');
        msg.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1rem;">No games found in this folder. Create one below!</div>';
        list.appendChild(msg);
    } else {
        games.forEach(g => {
            const card = document.createElement('div');
            card.className = 'session-item';
            // We don't have metadata easily without reading every folder, so just show name
            card.innerHTML = `
                <div class="session-info">
                    <h3>${g.name}</h3>
                    <div class="session-meta">Folder Game</div>
                </div>
                <div class="session-arrow">➜</div>
            `;
            card.onclick = async () => {
                await loadGameFromLibrary(g.handle, g.name);
            };
            list.appendChild(card);
        });
    }

    // Hijack the "New Session" form for "New Game Folder"
    const form = document.getElementById('new-session-form') as HTMLFormElement;

    // Update labels to reflect we are creating a folder
    const legend = form.querySelector('legend');
    if (legend) legend.textContent = 'Create New Game in Library';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-session-name') as HTMLInputElement;
        const kInput = document.getElementById('new-session-k') as HTMLInputElement;
        const gameName = nameInput.value.trim();

        if (gameName && store.libraryHandle) {
            try {
                const newGameDir = await createGameInLibrary(store.libraryHandle, gameName);

                // Initialize with empty state and settings
                const initialK = parseInt(kInput.value) || 60;
                const initialState = {
                    players: [],
                    matchHistory: [],
                    kFactor: initialK
                };

                await saveGameToSession(newGameDir, initialState);
                await loadGameFromLibrary(newGameDir, gameName);

            } catch (err) {
                console.error(err);
                showNotification('Failed to create game folder', 'error');
            }
        }
    };
}

async function loadGameFromLibrary(dirHandle: FileSystemDirectoryHandle, folderName: string) {
    try {
        store.directoryHandle = dirHandle;
        store.folderName = folderName;
        store.currentSessionId = null; // Clear local storage session ID

        // Load state
        const state = await loadGameFromSession(dirHandle);
        store.players = state.players;
        store.matchHistory = state.matchHistory;
        store.kFactor = state.kFactor;

        // Save library name for re-launch hint
        if (store.libraryHandle) {
            saveLastLibraryName(store.libraryHandle.name);
        }

        // UI Switch
        document.getElementById('game-menu')!.style.display = 'none';
        document.getElementById('app-main')!.style.display = 'block';

        updateKFactorInputState();
        store.hasUnsavedChanges = false;
        updateSaveButton();
        render(); // Initial render

        showNotification(`Loaded game: ${folderName}`);

        // Setup listeners if not already done (similar to loadSessionFromHash logic)
        setupEventListeners();

        // Ensure Save/Exit buttons are bound (they might not be if setupGlobalListeners ran too early)
        bindSaveExitListeners();

    } catch (e) {
        console.error(e);
        showNotification('Failed to load game', 'error');
    }
}

/**
 * Explicitly bind Save and Exit button listeners.
 * Uses onclick property to ensure handler is always set correctly.
 */
function bindSaveExitListeners() {
    const saveBtn = document.getElementById('nav-save-btn') as HTMLButtonElement | null;
    const exitBtn = document.getElementById('nav-exit-btn') as HTMLButtonElement | null;

    if (saveBtn) {
        console.log('bindSaveExitListeners: Setting Save onclick handler');
        saveBtn.onclick = handleSaveGame;
    } else {
        console.error('bindSaveExitListeners: Save button NOT FOUND!');
    }

    if (exitBtn) {
        console.log('bindSaveExitListeners: Setting Exit onclick handler');
        exitBtn.onclick = handleExit;
    } else {
        console.error('bindSaveExitListeners: Exit button NOT FOUND!');
    }
}

// --- MENU & ROUTING ---

function renderGameMenu() {
    // If we have a library loaded, render that instead
    if (store.libraryHandle) {
        renderGameLibrary(store.libraryHandle);
        return;
    }

    document.getElementById('game-menu')!.style.display = 'flex';
    document.getElementById('app-main')!.style.display = 'none';

    const list = document.getElementById('session-list')!;
    list.innerHTML = '';

    // Get last used library name for hint
    const lastLibraryName = getLastLibraryName();

    // Single button to choose save location (load existing games)
    const openFolderBtnContainer = document.createElement('div');
    openFolderBtnContainer.style.width = '100%';
    openFolderBtnContainer.style.textAlign = 'center';
    openFolderBtnContainer.style.marginBottom = '20px';

    const openFolderBtn = document.createElement('button');
    openFolderBtn.id = 'open-library-btn';
    openFolderBtn.className = 'button-primary';
    openFolderBtn.style.width = '100%';
    openFolderBtn.style.fontSize = '1.1rem';
    openFolderBtn.style.padding = '1rem';
    openFolderBtn.textContent = '📂 Load Saved Games';
    openFolderBtn.onclick = handleOpenLibrary;

    openFolderBtnContainer.appendChild(openFolderBtn);

    // Show hint if there's a last used library
    if (lastLibraryName) {
        const hint = document.createElement('p');
        hint.className = 'form-hint';
        hint.style.textAlign = 'center';
        hint.style.marginTop = '0.5rem';
        hint.innerHTML = `Last used: <strong>${lastLibraryName}</strong>`;
        openFolderBtnContainer.appendChild(hint);
    }

    list.appendChild(openFolderBtnContainer);

    const divider = document.createElement('hr');
    divider.style.width = '100%';
    divider.style.margin = '1.5rem 0';
    list.appendChild(divider);

    // EXAMPLE GAME card
    const exampleCard = document.createElement('div');
    exampleCard.className = 'session-item';
    exampleCard.innerHTML = `
        <div class="session-info">
            <h3>🎮 ${EXAMPLE_GAME_NAME}</h3>
            <div class="session-meta">Demo with sample players & matches</div>
        </div>
        <div class="session-arrow">➜</div>
    `;
    exampleCard.onclick = loadExampleGame;
    list.appendChild(exampleCard);

    // Show and setup the new session form
    const form = document.getElementById('new-session-form') as HTMLFormElement;
    if (form) {
        form.style.display = 'block';
        form.onsubmit = (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-session-name') as HTMLInputElement;
            const kInput = document.getElementById('new-session-k') as HTMLInputElement;

            if (nameInput.value) {
                // Start a new game with empty state (no folder yet)
                startNewGame(nameInput.value.trim(), parseInt(kInput.value) || 60);
            }
        };
    }
}

/**
 * Start a new game with empty state
 */
function startNewGame(name: string, kFactor: number) {
    store.players = [];
    store.matchHistory = [];
    store.kFactor = kFactor;
    store.currentSessionId = null;
    store.directoryHandle = null; // No folder yet - user must save to folder
    store.folderName = name;
    store.hasUnsavedChanges = true; // Mark as unsaved since it's not on disk

    // UI Switch
    document.getElementById('game-menu')!.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'block';

    updateKFactorInputState();
    updateSaveButton();
    setupEventListeners();
    bindSaveExitListeners();
    render();

    showNotification(`Created new game: ${name}`);
}

/**
 * Load the example game with sample data for demonstration
 */
function loadExampleGame() {
    const exampleState = getExampleGameState();

    store.players = exampleState.players;
    store.matchHistory = exampleState.matchHistory;
    store.kFactor = exampleState.kFactor;
    store.currentSessionId = null;
    store.directoryHandle = null; // No folder yet - user must save to folder
    store.folderName = EXAMPLE_GAME_NAME;
    store.hasUnsavedChanges = true; // Mark as unsaved since it's not on disk

    // UI Switch
    document.getElementById('game-menu')!.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'block';

    updateKFactorInputState();
    updateSaveButton();
    setupEventListeners();
    bindSaveExitListeners();
    render();

    showNotification(`Loaded ${EXAMPLE_GAME_NAME} - Choose a save location to keep your data!`);
}

function setupEventListeners() {
    // --- Event Listeners ---
    // Ensure we don't duplicate listeners if called multiple times (simple check)
    if (DOMElements.settingsForm?.hasAttribute('data-listening')) return;
    DOMElements.settingsForm?.setAttribute('data-listening', 'true');

    DOMElements.settingsForm?.addEventListener('submit', (e) => e.preventDefault());
    DOMElements.addPlayerForm?.addEventListener('submit', handleAddPlayer);
    DOMElements.recordMatchForm?.addEventListener('submit', handleRecordMatch);
    DOMElements.kFactorInput?.addEventListener('input', handleKFactorChange);
    DOMElements.updateLeaderboardBtn?.addEventListener('click', handleUpdateLeaderboardClick);

    DOMElements.exportPlayersBtn?.addEventListener('click', handleExportPlayers);

    if (DOMElements.importPlayersFile) {
        const context = { render, updateKFactorInputState, DOMElements };
        DOMElements.importPlayersFile.addEventListener('change', createImportPlayersHandler(context));
    }

    DOMElements.clearHistoryBtn?.addEventListener('click', handleClearMatchHistory);
    DOMElements.clearPlayersBtn?.addEventListener('click', handleClearPlayers);

    DOMElements.player1Input?.addEventListener('input', handleAutocompleteInput);
    DOMElements.player2Input?.addEventListener('input', handleAutocompleteInput);

    DOMElements.player1Input?.addEventListener('keydown', (e) => handleKeydown(e, 'p1'));
    DOMElements.player2Input?.addEventListener('keydown', (e) => handleKeydown(e, 'p2'));

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
}

function handleKeydown(event: KeyboardEvent, playerType: 'p1' | 'p2') {
    if (event.key === 'Tab') {
        const input = event.target as HTMLInputElement;
        let suggestionsContainer: HTMLElement | null, idInput: HTMLInputElement | null;

        if (playerType === 'p1') {
            suggestionsContainer = DOMElements.player1Suggestions;
            idInput = DOMElements.player1IdInput;
        } else {
            suggestionsContainer = DOMElements.player2Suggestions;
            idInput = DOMElements.player2IdInput;
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
    if (store.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to exit without saving?')) {
            return;
        }
    }

    // Clear game state but keep library handle
    store.directoryHandle = null;
    store.folderName = null;
    store.currentSessionId = null;
    store.players = [];
    store.matchHistory = [];
    store.hasUnsavedChanges = false;

    // Switch back to menu (will show library if libraryHandle is set)
    document.getElementById('app-main')!.style.display = 'none';
    renderGameMenu();
}



async function handleSaveGame() {
    console.log('handleSaveGame called');
    // alert('Debug: Save button clicked!'); // Temporary debug

    // Case 1: Already a valid file system game
    if (store.directoryHandle) {
        try {
            await saveGameToSession(store.directoryHandle, {
                players: store.players,
                matchHistory: store.matchHistory,
                kFactor: store.kFactor
            });
            store.hasUnsavedChanges = false;
            updateSaveButton();
            broadcastGameUpdate(); // Notify other windows
            showNotification('Game saved successfully');
        } catch (e) {
            console.error(e);
            showNotification('Failed to save game', 'error');
        }
        return;
    }

    // Case 2: Legacy/Memory Session -> Export to Library
    if (!confirm('This will save the current game to a folder. Continue?')) {
        return;
    }

    try {
        // 1. Pick Library Folder
        const libraryHandle = await selectLibraryFolder();
        if (!libraryHandle) return; // Cancelled

        // 2. Ask for new game name
        const defaultName = store.folderName || `Game_${new Date().toISOString().split('T')[0]}`;
        const gameName = prompt('Enter a name for the new game folder:', defaultName);
        if (!gameName) return; // Cancelled

        // 3. Create Game Folder
        const newGameDir = await createGameInLibrary(libraryHandle, gameName);

        // 4. Save Current State
        await saveGameToSession(newGameDir, {
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor
        });

        // 5. Switch Context to file mode
        store.libraryHandle = libraryHandle;
        store.directoryHandle = newGameDir;
        store.folderName = gameName;
        store.currentSessionId = null;
        store.hasUnsavedChanges = false;

        // 6. Save library name for re-launch hint and clear temp localStorage data
        saveLastLibraryName(libraryHandle.name);
        clearTemporaryData();

        updateSaveButton();
        render();

        showNotification(`Successfully saved to ${gameName}`);

    } catch (e: any) {
        console.error(e);
        const msg = e.message || 'Unknown error occurred';
        showNotification(`Failed to save: ${msg}`, 'error');
    }
}

// --- MAIN ---

// --- INITIALIZATION HELPERS ---

function setupGlobalListeners() {
    // Navigation Listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.classList.contains('nav-exit')) return;
        // Avoid dual binding
        if (btn.hasAttribute('data-bound')) return;
        btn.setAttribute('data-bound', 'true');

        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    const exitBtn = document.getElementById('nav-exit-btn');
    if (exitBtn && !exitBtn.hasAttribute('data-bound')) {
        exitBtn.setAttribute('data-bound', 'true');
        exitBtn.addEventListener('click', handleExit);
    }

    // Save Game Button Listener
    const saveBtn = document.getElementById('nav-save-btn');
    if (saveBtn) {
        if (!saveBtn.hasAttribute('data-bound')) {
            console.log('Attaching click listener to Save Button');
            saveBtn.setAttribute('data-bound', 'true');
            saveBtn.addEventListener('click', handleSaveGame);
        } else {
            console.log('Save Button already bound');
        }
    } else {
        console.error('CRITICAL: Save Button (nav-save-btn) NOT FOUND in DOM!');
    }

    // Click outside for suggestions
    if (!document.body.hasAttribute('data-global-click')) {
        document.body.setAttribute('data-global-click', 'true');
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
    }

    // Export PDF Button
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn && !exportPdfBtn.hasAttribute('data-bound')) {
        exportPdfBtn.setAttribute('data-bound', 'true');
        exportPdfBtn.addEventListener('click', () => {
            const gameName = store.folderName || 'Game of Stick';
            generateGamePDF(store.players, store.matchHistory, gameName);
            showNotification('PDF exported successfully!');
        });
    }

    // Sync across tabs
    if (!window['__storageInit' as any]) {
        // @ts-ignore
        window['__storageInit'] = true;
        window.addEventListener('storage', (e) => {
            if (store.currentSessionId && e.key === `session_${store.currentSessionId}`) {
                syncSession();
            }
            if (!store.currentSessionId && e.key === 'game-of-stick-sessions') {
                renderGameMenu();
            }
        });
    }
}

// --- MAIN ---
function main() {
    DOMElements = queryDOMElements();
    setupGlobalListeners();

    // Check compatibility
    if (!('showDirectoryPicker' in window)) {
        showNotification('⚠️ Your browser doesn\'t support saving to folders. Please use Chrome, Edge, or Opera.', 'error');
        updateStatusBarMessage('Browser not supported for folder access', 'error');
    }

    if (loadSessionFromHash()) {
        updateKFactorInputState();
        // Extra safety: Always hide modal and clear content on load
        if (DOMElements.playerCardModal) {
            DOMElements.playerCardModal.setAttribute('hidden', 'true');
            const contentDiv = document.getElementById('player-card-content');
            if (contentDiv) contentDiv.innerHTML = '';
        }

        setupEventListeners();
        render();
    } else {
        renderGameMenu();
    }
}

// Wait for the DOM to be fully loaded before running the main script
document.addEventListener('DOMContentLoaded', main);
