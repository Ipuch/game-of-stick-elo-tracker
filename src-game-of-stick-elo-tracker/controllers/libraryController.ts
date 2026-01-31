/**
 * Game of STICK - ELO Tracker
 * Library Controller
 * Manages game library, loading, and creating games
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { store } from '../state/store';
import { 
    loadGameFromSession, 
    saveGameToSession, 
    createGameInLibrary, 
    selectLibraryFolder,
    saveTempBackup,
    loadTempBackup,
    deleteTempBackup
} from '../utils/fileSystemPersistence';
import { loadRegistry } from '../utils/registryPersistence';
import { saveLastLibraryName } from '../utils/localStoragePersistence';
import { renderGameLibrary } from '../renderers/libraryRenderer';
import { renderAggregatedDashboard, hideAggregatedDashboard } from '../renderers/aggregatedDashboard';
import { renderRegistryManager, hideRegistryManager } from '../renderers/registryManager';
import { showNotification } from '../ui/notificationSystem';
import { handleError } from '../utils/errorHandler';

export interface LibraryCallbacks {
    onLoadGame: (dirHandle: FileSystemDirectoryHandle, folderName: string) => Promise<void>;
    onCreateGame: (name: string, kFactor: number) => Promise<void>;
    onViewAggregatedStats: () => void;
    onViewRegistry: () => void;
    onViewRules: () => void;
}

export interface GameLoadCallbacks {
    updateKFactorInputState: () => void;
    updateSaveButton: () => void;
    render: () => void;
    setupEventListeners: () => void;
    bindSaveExitListeners: () => void;
}

let gameLoadCallbacks: GameLoadCallbacks | null = null;

/**
 * Initialize the library controller with callbacks
 */
export function initLibraryController(callbacks: GameLoadCallbacks): void {
    gameLoadCallbacks = callbacks;
}

/**
 * Get library callbacks for renderGameLibrary
 */
export function getLibraryCallbacks(viewRulesHandler: () => void): LibraryCallbacks {
    return {
        onLoadGame: loadGameFromLibrary,
        onCreateGame: createNewGameInLibrary,
        onViewAggregatedStats: handleViewAggregatedStats,
        onViewRegistry: handleViewRegistry,
        onViewRules: viewRulesHandler
    };
}

/**
 * Open a library folder and display its contents
 */
export async function handleOpenLibrary(viewRulesHandler: () => void): Promise<void> {
    try {
        const libraryHandle = await selectLibraryFolder();
        if (!libraryHandle) return;

        store.libraryHandle = libraryHandle;

        // Load global player registry
        try {
            store.registry = await loadRegistry(libraryHandle);
            store.registryLoaded = true;
            console.log(`Registry loaded: ${store.registry.length} players`);
        } catch (e) {
            handleError(e, {
                context: 'LoadRegistry',
                severity: 'warning'
            });
            store.registry = [];
        }

        renderGameLibrary(libraryHandle, getLibraryCallbacks(viewRulesHandler));
    } catch (e) {
        handleError(e, {
            context: 'OpenLibrary',
            userMessage: 'Failed to open library'
        });
    }
}

/**
 * View aggregated stats across all games in the library
 */
export function handleViewAggregatedStats(): void {
    if (!store.libraryHandle) {
        showNotification('No library loaded', 'error');
        return;
    }
    
    renderAggregatedDashboard(store.libraryHandle, {
        onBack: () => {
            hideAggregatedDashboard();
            renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => {}));
        }
    });
}

/**
 * View and manage the player registry
 */
export function handleViewRegistry(): void {
    if (!store.libraryHandle) {
        showNotification('No library loaded', 'error');
        return;
    }
    
    renderRegistryManager({
        onBack: () => {
            hideRegistryManager();
            renderGameLibrary(store.libraryHandle!, getLibraryCallbacks(() => {}));
        }
    });
}

/**
 * Create a new game in the library
 */
export async function createNewGameInLibrary(name: string, kFactor: number): Promise<void> {
    if (!store.libraryHandle) return;
    
    try {
        const newGameDir = await createGameInLibrary(store.libraryHandle, name);
        const initialState = {
            players: [],
            matchHistory: [],
            kFactor: kFactor
        };
        await saveGameToSession(newGameDir, initialState);
        await loadGameFromLibrary(newGameDir, name);
    } catch (err) {
        handleError(err, {
            context: 'CreateGame',
            userMessage: 'Failed to create game folder'
        });
    }
}

/**
 * Load a game from the library
 */
export async function loadGameFromLibrary(
    dirHandle: FileSystemDirectoryHandle, 
    folderName: string
): Promise<void> {
    if (!gameLoadCallbacks) {
        console.error('LibraryController not initialized');
        return;
    }

    try {
        store.directoryHandle = dirHandle;
        store.folderName = folderName;
        store.currentSessionId = null;

        // Load standard state
        let state = await loadGameFromSession(dirHandle);

        // CHECK FOR BACKUP
        if (store.libraryHandle) {
            const backup = await loadTempBackup(store.libraryHandle, folderName);
            if (backup) {
                // Formulate date string for prompt
                const dateStr = new Date(backup.timestamp).toLocaleString();
                if (confirm(`⚠️ Unsaved crash recovery file found (${dateStr}).\n\nDo you want to restore it?`)) {
                    console.log('Restoring from backup...');
                    state = backup.state;
                    store.hasUnsavedChanges = true;
                } else {
                    await deleteTempBackup(store.libraryHandle, folderName);
                }
            }
        }

        store.players = state.players;
        store.matchHistory = state.matchHistory;
        store.kFactor = state.kFactor;

        // Initialize ELO snapshots
        initializeLeaderboardSnapshots();

        if (store.libraryHandle) {
            saveLastLibraryName(store.libraryHandle.name);

            // Ensure registry is loaded
            if (!store.registryLoaded) {
                try {
                    store.registry = await loadRegistry(store.libraryHandle);
                    store.registryLoaded = true;
                } catch (e) {
                    handleError(e, {
                        context: 'LoadRegistry',
                        severity: 'warning'
                    });
                }
            }
        }

        // Show game view
        document.getElementById('game-menu')!.style.display = 'none';
        document.getElementById('app-main')!.style.display = 'block';

        gameLoadCallbacks.updateKFactorInputState();
        gameLoadCallbacks.updateSaveButton();

        // Update save button if we restored from backup
        if (store.hasUnsavedChanges) {
            const btn = document.getElementById('nav-save-btn');
            if (btn) {
                btn.textContent = 'Save Game *';
                btn.classList.add('unsaved');
            }
        }

        gameLoadCallbacks.render();

        showNotification(`Loaded game: ${folderName}`);

        gameLoadCallbacks.setupEventListeners();
        gameLoadCallbacks.bindSaveExitListeners();

    } catch (e) {
        handleError(e, {
            context: 'LoadGame',
            userMessage: 'Failed to load game'
        });
    }
}

/**
 * Initialize both ELO and rank snapshots with current state
 */
function initializeLeaderboardSnapshots(): void {
    // Initialize ELO snapshots (both same = no diff shown initially)
    store.lastLeaderboardElo = {};
    store.previousLeaderboardElo = {};
    store.players.forEach(p => {
        store.lastLeaderboardElo[p.id] = p.elo;
        store.previousLeaderboardElo[p.id] = p.elo;
    });
    
    // Initialize rank snapshots (both same = no rank diff shown)
    const sortedPlayers = [...store.players].sort((a, b) => b.elo - a.elo);
    store.lastLeaderboardRanks = {};
    store.previousLeaderboardRanks = {};
    sortedPlayers.forEach((p, index) => {
        const rank = index + 1;
        store.lastLeaderboardRanks[p.id] = rank;
        store.previousLeaderboardRanks[p.id] = rank;
        p.previousRank = rank;
    });
}

/**
 * Create debounced temp backup saver
 */
let backupDebounceTimer: number | null = null;

export function scheduleTempBackup(): void {
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
}
