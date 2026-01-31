/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { loadSession, saveSession } from './utils/localStoragePersistence';
import { getExampleGameState, EXAMPLE_GAME_NAME } from './utils/exampleGameData';
import { AppDOMElements, queryDOMElements } from './utils/domElements';
import { renderLeaderboard } from './renderers/leaderboard';
import { renderPodium } from './renderers/podium';
import { renderBattleHistory } from './renderers/battleHistory';
import { renderCombatMatrix } from './renderers/combatMatrix';
import { saveTempBackup } from './utils/fileSystemPersistence';

// New Imports for Refactoring
import { store } from './state/store';
import { renderProfileStatsSection } from './renderers/profileStats';
import { renderEloEvolutionChart } from './renderers/eloEvolutionChart';
import { generateGamePDF } from './utils/pdfExport';
import { generateGameInstagramStories } from './utils/instagramExport';
import { handleExportPlayers, createImportPlayersHandler } from './handlers/importExportHandlers';
import { AppContext, MatchContext, SessionContext, createMatchContext, createImportContext } from './types/contextTypes';

// Controllers
import { 
    initLibraryController, 
    handleOpenLibrary, 
    getLibraryCallbacks,
    GameLoadCallbacks
} from './controllers/libraryController';
import {
    initLiveDisplayController,
    handleLaunchLiveDisplay,
    isLiveDisplayActive,
    handleExitLiveDisplay,
    refreshLiveDisplayIfVisible
} from './controllers/liveDisplayController';

// Services
import { setupSyncListener } from './services/syncService';
import { showNotification, updateStatusBar } from './ui/notificationSystem';

// i18n
import { initI18n, toggleLocale, updateLocaleButtons, t } from './utils/i18n';

// UI & Renderers
import { handleAutocompleteInput, handleKeydown, hideSuggestions } from './ui/autocomplete';
import { renderRosterList } from './renderers/rosterRenderer';
import { renderRemainingOpponents } from './renderers/opponentsRenderer';
import { renderGameLibrary } from './renderers/libraryRenderer';
import { renderGameMenu } from './renderers/menuRenderer';
import { renderRulesView, showRulesView, hideRulesView } from './renderers/rulesRenderer';

// Handlers
import { handleRecordMatch, updateWinnerLabels, handleClearMatchHistory } from './handlers/matchHandlers';
import { handleAddPlayer, handleClearPlayers } from './handlers/playerHandlers';
import { handleSaveGame, handleExit, bindSaveExitListeners } from './handlers/sessionHandlers';

// --- DOM ELEMENTS ---
let DOMElements: AppDOMElements; // Global declaration

// --- UI UPDATE CONTROLLER ---

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

function updateSaveButton() {
    const btn = document.getElementById('nav-save-btn');
    if (!btn) return;

    btn.style.display = 'inline-block';

    if (store.directoryHandle) {
        if (store.hasUnsavedChanges) {
            btn.textContent = 'Save Game *';
            btn.classList.add('unsaved');
        } else {
            btn.textContent = 'Save Game';
            btn.classList.remove('unsaved');
        }
    } else {
        btn.textContent = 'Save to Folder';
        btn.classList.remove('unsaved');
    }
    updateStatusBar();
}

// Debounce timer for temp backup (avoid constant disk I/O)
let backupDebounceTimer: number | null = null;

function persist() {
    if (store.directoryHandle) {
        store.hasUnsavedChanges = true;
        updateSaveButton();

        // AUTO-SAVE to .temp (DEBOUNCED - 1 second)
        if (store.libraryHandle && store.folderName) {
            if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
            const libraryHandle = store.libraryHandle;
            const folderName = store.folderName;
            backupDebounceTimer = window.setTimeout(() => {
                saveTempBackup(libraryHandle, folderName, {
                    players: store.players,
                    matchHistory: store.matchHistory,
                    kFactor: store.kFactor
                });
            }, 1000);
        }

    } else if (store.currentSessionId) {
        saveSession(store.currentSessionId, {
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor
        });
    }
}

/**
 * Update all DOM elements with data-i18n attributes
 */
function updateI18nTexts(): void {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            const text = t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                (el as HTMLInputElement).placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
}

function render() {
    // Core Renderers - pass both ELO and rank snapshots for frozen diff display
    renderLeaderboard(
        store.players, DOMElements, store.matchHistory,
        store.previousLeaderboardElo, store.lastLeaderboardElo,
        store.previousLeaderboardRanks, store.lastLeaderboardRanks
    );
    renderPodium(store.players, DOMElements);
    renderBattleHistory(store.matchHistory, DOMElements);
    renderCombatMatrix(store.players, store.matchHistory, DOMElements);

    // Extracted Renderers
    renderProfileStatsSection(store.players, store.matchHistory);
    renderEloEvolutionChart(store.players, store.matchHistory);
    renderRosterList(store.players, DOMElements.rosterList || undefined);
    renderRemainingOpponents(store.players, store.matchHistory, DOMElements);

    // persist(); // REMOVED: persist should be called by handlers, not render
}

/**
 * Render all UI elements EXCEPT the leaderboard and podium.
 * Used after recording matches so leaderboard/podium updates are manual (via Update button).
 */
function renderWithoutLeaderboard() {
    // NOTE: Podium is intentionally NOT rendered here - it should only update
    // when the Update button is clicked (same as leaderboard)
    renderBattleHistory(store.matchHistory, DOMElements);
    renderCombatMatrix(store.players, store.matchHistory, DOMElements);

    renderProfileStatsSection(store.players, store.matchHistory);
    renderEloEvolutionChart(store.players, store.matchHistory);
    renderRosterList(store.players, DOMElements.rosterList || undefined);
    renderRemainingOpponents(store.players, store.matchHistory, DOMElements);
}

/**
 * Shared function to update leaderboard baseline (ELO snapshot and ranks).
 * Called by both main leaderboard and live display update buttons.
 */
function updateLeaderboardBaseline() {
    // Shift ELO snapshots: old "last" becomes "previous"
    store.previousLeaderboardElo = { ...store.lastLeaderboardElo };
    
    // Capture current ELOs as new "last" snapshot
    store.lastLeaderboardElo = {};
    store.players.forEach(p => {
        store.lastLeaderboardElo[p.id] = p.elo;
    });

    // Shift rank snapshots: old "last" becomes "previous"
    store.previousLeaderboardRanks = { ...store.lastLeaderboardRanks };
    
    // Capture current ranks as new "last" snapshot
    const sortedPlayers = [...store.players].sort((a, b) => b.elo - a.elo);
    store.lastLeaderboardRanks = {};
    sortedPlayers.forEach((p, index) => {
        store.lastLeaderboardRanks[p.id] = index + 1;
    });

    // Also update player.previousRank for backwards compatibility
    store.players.forEach(p => {
        p.previousRank = store.lastLeaderboardRanks[p.id];
    });
}

function handleUpdateLeaderboardClick() {
    // FIRST update baseline (shift: previous=last, last=current)
    updateLeaderboardBaseline();
    // THEN render - diffs shown = lastLeaderboardElo - previousLeaderboardElo
    render();
    // Also refresh live view if it's currently visible
    refreshLiveDisplayIfVisible();
}

function handleKFactorChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val > 0) {
        store.kFactor = val;
        persist();
    }
}

// --- CONTEXT PREPARATION ---
const getAppContext = (): AppContext => ({
    render,
    persist,
    updateKFactorInputState,
    DOMElements
});

const getMatchContext = (): MatchContext => createMatchContext(getAppContext(), renderWithoutLeaderboard);

const getPlayerContext = getAppContext;

// SessionContext definition matches expected type in handlers
const getSessionContext = (): SessionContext => ({
    render,
    updateSaveButton,
    renderGameMenu: () => renderGameMenu(store, {
        onOpenLibrary: () => handleOpenLibrary(() => handleViewRules('library')),
        onLoadExample: loadExampleGame,
        onStartNewGame: startNewGame,
        renderLibrary: () => renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => handleViewRules('library'))),
        onViewRules: () => handleViewRules('menu')
    })
});

// --- LIBRARY LOGIC ---
// Moved to controllers/libraryController.ts
// But we need to initialize the controller with callbacks to accessing this file's functions
function initControllers() {
    const gameLoadCallbacks: GameLoadCallbacks = {
        updateKFactorInputState,
        updateSaveButton,
        render,
        setupEventListeners,
        bindSaveExitListeners: () => bindSaveExitListeners(
            () => handleSaveGame(getSessionContext()),
            () => handleExit(getSessionContext())
        )
    };
    initLibraryController(gameLoadCallbacks);
    
    initLiveDisplayController({
        updateLeaderboardBaseline,
        getDOMElements: () => DOMElements
    });
}

// Track where rules was opened from for correct back navigation
let rulesOpenedFrom: 'menu' | 'game' | 'library' = 'menu';

function handleViewRules(from: 'menu' | 'game' | 'library' = 'menu') {
    rulesOpenedFrom = from;
    const rulesContainer = document.getElementById('rules-view');
    if (rulesContainer) {
        renderRulesView(rulesContainer, {
            onBack: () => {
                hideRulesView();
                if (rulesOpenedFrom === 'game') {
                    document.getElementById('app-main')!.style.display = 'block';
                } else if (rulesOpenedFrom === 'library' && store.libraryHandle) {
                    renderGameLibrary(store.libraryHandle, getLibraryCallbacks(() => handleViewRules('library')));
                } else {
                    document.getElementById('game-menu')!.style.display = 'flex';
                }
            }
        });
        showRulesView();
    }
}

// Live Display logic moved to controllers/liveDisplayController.ts

// --- SESSION LOGIC ---

function startNewGame(name: string, kFactor: number) {
    store.players = [];
    store.matchHistory = [];
    store.kFactor = kFactor;
    store.currentSessionId = null;
    store.directoryHandle = null;
    store.folderName = name;
    store.hasUnsavedChanges = true;

    document.getElementById('game-menu')!.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'block';

    updateKFactorInputState();
    updateSaveButton();
    setupEventListeners();
    bindSaveExitListeners(
        () => handleSaveGame(getSessionContext()),
        () => handleExit(getSessionContext())
    );
    render();

    showNotification(`Created new game: ${name}`);
}

function loadExampleGame() {
    const exampleState = getExampleGameState();
    store.players = exampleState.players;
    store.matchHistory = exampleState.matchHistory;
    store.kFactor = exampleState.kFactor;
    store.currentSessionId = null;
    store.directoryHandle = null;
    store.folderName = EXAMPLE_GAME_NAME;
    store.hasUnsavedChanges = true;

    document.getElementById('game-menu')!.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'block';

    updateKFactorInputState();
    updateSaveButton();
    setupEventListeners();
    bindSaveExitListeners(
        () => handleSaveGame(getSessionContext()),
        () => handleExit(getSessionContext())
    );
    render();

    showNotification(`Loaded ${EXAMPLE_GAME_NAME} - Choose a save location to keep your data!`);
}

// --- SETUP ---

function setupEventListeners() {
    if (DOMElements.settingsForm?.hasAttribute('data-listening')) return;
    DOMElements.settingsForm?.setAttribute('data-listening', 'true');

    DOMElements.settingsForm?.addEventListener('submit', (e) => e.preventDefault());

    // Handlers with Context
    DOMElements.addPlayerForm?.addEventListener('submit', (e) => handleAddPlayer(e, getPlayerContext()));
    DOMElements.recordMatchForm?.addEventListener('submit', (e) => handleRecordMatch(e, getMatchContext()));

    DOMElements.kFactorInput?.addEventListener('input', handleKFactorChange);
    DOMElements.updateLeaderboardBtn?.addEventListener('click', handleUpdateLeaderboardClick);
    DOMElements.exportPlayersBtn?.addEventListener('click', handleExportPlayers);

    if (DOMElements.importPlayersFile) {
        const context = { render, updateKFactorInputState, DOMElements };
        DOMElements.importPlayersFile.addEventListener('change', createImportPlayersHandler(context));
    }

    DOMElements.clearHistoryBtn?.addEventListener('click', () => handleClearMatchHistory(getMatchContext()));
    DOMElements.clearPlayersBtn?.addEventListener('click', () => handleClearPlayers(getPlayerContext()));

    // Autocomplete
    const autocompleteContext = { updateWinnerLabels: () => updateWinnerLabels(DOMElements) };
    DOMElements.player1Input?.addEventListener('input', (e) => handleAutocompleteInput(e, DOMElements, autocompleteContext));
    DOMElements.player2Input?.addEventListener('input', (e) => handleAutocompleteInput(e, DOMElements, autocompleteContext));
    DOMElements.player1Input?.addEventListener('keydown', (e) => handleKeydown(e, 'p1', DOMElements, autocompleteContext));
    DOMElements.player2Input?.addEventListener('keydown', (e) => handleKeydown(e, 'p2', DOMElements, autocompleteContext));

    // Battle History Toggle
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

function setupGlobalListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.classList.contains('nav-exit')) return;
        if (btn.id === 'nav-rules-btn') return; // Rules has its own handler
        if (btn.hasAttribute('data-bound')) return;
        btn.setAttribute('data-bound', 'true');
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view) {
                document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
                document.getElementById(view)?.classList.add('active');
                btn.classList.add('active');
            }
        });
    });

    const exitBtn = document.getElementById('nav-exit-btn');
    if (exitBtn && !exitBtn.hasAttribute('data-bound')) {
        exitBtn.setAttribute('data-bound', 'true');
        exitBtn.addEventListener('click', () => handleExit(getSessionContext()));
    }

    // Save Game Listener
    const saveBtn = document.getElementById('nav-save-btn');
    if (saveBtn && !saveBtn.hasAttribute('data-bound')) {
        saveBtn.setAttribute('data-bound', 'true');
        saveBtn.addEventListener('click', () => handleSaveGame(getSessionContext()));
    }

    // Rules button listener (in-game)
    const rulesBtn = document.getElementById('nav-rules-btn');
    if (rulesBtn && !rulesBtn.hasAttribute('data-bound')) {
        rulesBtn.setAttribute('data-bound', 'true');
        rulesBtn.addEventListener('click', () => handleViewRules('game'));
    }

    // Global Click for Suggestions
    if (!document.body.hasAttribute('data-global-click')) {
        document.body.setAttribute('data-global-click', 'true');
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (DOMElements.recordMatchForm && !DOMElements.recordMatchForm.contains(target)) {
                hideSuggestions(DOMElements.player1Suggestions);
                hideSuggestions(DOMElements.player2Suggestions);
            }
            if (target && target.id === 'empty-leaderboard-link') {
                event.preventDefault();
                // Manual switch view logic
                document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
                document.getElementById('view-roster')?.classList.add('active');
                document.querySelector('.nav-btn[data-view="view-roster"]')?.classList.add('active');
            }
        });
    }

    // PDF Export
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn && !exportPdfBtn.hasAttribute('data-bound')) {
        exportPdfBtn.setAttribute('data-bound', 'true');
        exportPdfBtn.addEventListener('click', () => {
            const gameName = store.folderName || 'Game of Stick';
            generateGamePDF(store.players, store.matchHistory, gameName);
            showNotification('PDF exported successfully!');
        });
    }

    // Instagram Stories Export
    const exportInstaBtn = document.getElementById('export-instagram-btn');
    if (exportInstaBtn && !exportInstaBtn.hasAttribute('data-bound')) {
        exportInstaBtn.setAttribute('data-bound', 'true');
        exportInstaBtn.addEventListener('click', async () => {
            const gameName = store.folderName || 'Game of Stick';
            showNotification('Generating Instagram stories...');
            try {
                await generateGameInstagramStories(store.players, store.matchHistory, gameName);
                showNotification('Instagram stories exported!');
            } catch (e) {
                console.error(e);
                showNotification('Failed to export stories', 'error');
            }
        });
    }

    // Live Display
    const liveDisplayBtn = document.getElementById('live-display-btn');
    if (liveDisplayBtn && !liveDisplayBtn.hasAttribute('data-bound')) {
        liveDisplayBtn.setAttribute('data-bound', 'true');
        liveDisplayBtn.addEventListener('click', () => handleLaunchLiveDisplay());
    }

    // Keyboard listener for Escape to exit Live Display
    if (!document.body.hasAttribute('data-live-key-listener')) {
        document.body.setAttribute('data-live-key-listener', 'true');
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isLiveDisplayActive()) {
                handleExitLiveDisplay();
            }
        });
    }

    // Sync
    setupSyncListener({
        onSyncStart: () => { },
        onSyncComplete: () => { },
        updateKFactorInputState,
        updateSaveButton,
        renderAll: render
    });

    // Cross-tab Sync
    if (!window['__storageInit' as any]) {
        // @ts-ignore
        window['__storageInit'] = true;
        window.addEventListener('storage', (e) => {
            if (store.currentSessionId && e.key === `session_${store.currentSessionId}`) {
                const state = loadSession(store.currentSessionId);
                if (state) {
                    store.players = state.players;
                    store.matchHistory = state.matchHistory;
                    store.kFactor = state.kFactor;
                    updateKFactorInputState();
                    render();
                }
            }
            if (!store.currentSessionId && e.key === 'game-of-stick-sessions') {
                renderGameMenu(store, {
                    onOpenLibrary: () => handleOpenLibrary(() => handleViewRules('library')),
                    onLoadExample: loadExampleGame,
                    onStartNewGame: startNewGame,
                    renderLibrary: () => renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => handleViewRules('library'))),
                    onViewRules: () => handleViewRules('menu')
                });
            }
        });
    }
}

// --- MAIN ENTRY POINT ---
function main() {
    // Initialize i18n first
    try {
        initI18n();
        updateLocaleButtons();
        updateI18nTexts();
    } catch (e) {
        console.error('i18n initialization failed', e);
    }

    // Setup locale toggle buttons
    document.querySelectorAll('.locale-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleLocale();
            updateLocaleButtons();
            updateI18nTexts();
        });
    });

    DOMElements = queryDOMElements();
    
    // Initialize controllers after DOM is ready
    try {
        initControllers();
    } catch (e) {
        console.error('Controller initialization failed', e);
        showNotification('System initialization warning', 'error');
    }
    
    try {
        setupLiveDisplayKeyboardListener();
        setupGlobalListeners();
    } catch (e) {
        console.error('Listener setup failed', e);
    }

    if (!('showDirectoryPicker' in window)) {
        showNotification('⚠️ Your browser doesn\'t support saving to folders.', 'error');
        updateStatusBar(); // Will show error style
    }

    // URL Hash Config (Legacy)
    try {
        const hash = window.location.hash;
        if (hash.startsWith('#game_')) {
            const id = hash.replace('#game_', '');
            const state = loadSession(id);
            if (state) {
                store.currentSessionId = id;
                store.players = state.players;
                store.matchHistory = state.matchHistory;
                store.kFactor = state.kFactor;

                document.getElementById('game-menu')!.style.display = 'none';
                document.getElementById('app-main')!.style.display = 'block';

                updateKFactorInputState();
                setupEventListeners();
                render();
                return;
            }
        }
    } catch (e) {
        console.error('Legacy load failed', e);
    }

    // Default: Show Menu
    try {
        renderGameMenu(store, {
            onOpenLibrary: () => handleOpenLibrary(() => handleViewRules('library')),
            onLoadExample: loadExampleGame,
            onStartNewGame: startNewGame,
            renderLibrary: () => renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => handleViewRules('library'))),
            onViewRules: () => handleViewRules('menu')
        });
    } catch (e) {
        console.error('Render menu failed', e);
        showNotification('Failed to load menu', 'error');
    }
}

    // URL Hash Config (Legacy)
    const hash = window.location.hash;
    if (hash.startsWith('#game_')) {
        const id = hash.replace('#game_', '');
        const state = loadSession(id);
        if (state) {
            store.currentSessionId = id;
            store.players = state.players;
            store.matchHistory = state.matchHistory;
            store.kFactor = state.kFactor;

            document.getElementById('game-menu')!.style.display = 'none';
            document.getElementById('app-main')!.style.display = 'block';

            updateKFactorInputState();
            setupEventListeners();
            render();
            return;
        }
    }

    // Default: Show Menu
    renderGameMenu(store, {
        onOpenLibrary: () => handleOpenLibrary(() => handleViewRules('library')),
        onLoadExample: loadExampleGame,
        onStartNewGame: startNewGame,
        renderLibrary: () => renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => handleViewRules('library'))),
        onViewRules: () => handleViewRules('menu')
    });
}

document.addEventListener('DOMContentLoaded', main);
