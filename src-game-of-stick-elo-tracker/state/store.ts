/**
 * Game of STICK - ELO Tracker
 * Refactored State Management
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { GlobalPlayer } from '../types/registryTypes';
import { DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';

/**
 * Application state interface
 */
export interface AppState {
    players: Player[];
    matchHistory: Match[];
    kFactor: number;
    isRealtimeUpdate: boolean;
    
    // Two-snapshot system for diff display
    previousLeaderboardElo: Record<string, number>;
    lastLeaderboardElo: Record<string, number>;
    previousLeaderboardRanks: Record<string, number>;
    lastLeaderboardRanks: Record<string, number>;
    
    // Session state
    currentSessionId: string | null;
    directoryHandle: FileSystemDirectoryHandle | null;
    libraryHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
    hasUnsavedChanges: boolean;

    // Player Registry
    registry: GlobalPlayer[];
    registryLoaded: boolean;
}

/**
 * Create initial state
 */
function createInitialState(): AppState {
    return {
        players: [],
        matchHistory: [],
        kFactor: DEFAULT_ELO_CONFIG.parameters.kFactor,
        isRealtimeUpdate: true,
        
        previousLeaderboardElo: {},
        lastLeaderboardElo: {},
        previousLeaderboardRanks: {},
        lastLeaderboardRanks: {},
        
        currentSessionId: null,
        directoryHandle: null,
        libraryHandle: null,
        folderName: null,
        hasUnsavedChanges: false,

        registry: [],
        registryLoaded: false,
    };
}

/**
 * AppStore class with testable design
 * 
 * Note: This maintains backward compatibility with the singleton pattern
 * while adding reset capability for testing.
 */
export class AppStore {
    private _state: AppState;

    constructor(initialState?: Partial<AppState>) {
        this._state = {
            ...createInitialState(),
            ...initialState
        };
    }

    // --- Getters for all state properties ---
    get players(): Player[] { return this._state.players; }
    set players(value: Player[]) { this._state.players = value; }

    get matchHistory(): Match[] { return this._state.matchHistory; }
    set matchHistory(value: Match[]) { this._state.matchHistory = value; }

    get kFactor(): number { return this._state.kFactor; }
    set kFactor(value: number) { this._state.kFactor = value; }

    get isRealtimeUpdate(): boolean { return this._state.isRealtimeUpdate; }
    set isRealtimeUpdate(value: boolean) { this._state.isRealtimeUpdate = value; }

    get previousLeaderboardElo(): Record<string, number> { return this._state.previousLeaderboardElo; }
    set previousLeaderboardElo(value: Record<string, number>) { this._state.previousLeaderboardElo = value; }

    get lastLeaderboardElo(): Record<string, number> { return this._state.lastLeaderboardElo; }
    set lastLeaderboardElo(value: Record<string, number>) { this._state.lastLeaderboardElo = value; }

    get previousLeaderboardRanks(): Record<string, number> { return this._state.previousLeaderboardRanks; }
    set previousLeaderboardRanks(value: Record<string, number>) { this._state.previousLeaderboardRanks = value; }

    get lastLeaderboardRanks(): Record<string, number> { return this._state.lastLeaderboardRanks; }
    set lastLeaderboardRanks(value: Record<string, number>) { this._state.lastLeaderboardRanks = value; }

    get currentSessionId(): string | null { return this._state.currentSessionId; }
    set currentSessionId(value: string | null) { this._state.currentSessionId = value; }

    get directoryHandle(): FileSystemDirectoryHandle | null { return this._state.directoryHandle; }
    set directoryHandle(value: FileSystemDirectoryHandle | null) { this._state.directoryHandle = value; }

    get libraryHandle(): FileSystemDirectoryHandle | null { return this._state.libraryHandle; }
    set libraryHandle(value: FileSystemDirectoryHandle | null) { this._state.libraryHandle = value; }

    get folderName(): string | null { return this._state.folderName; }
    set folderName(value: string | null) { this._state.folderName = value; }

    get hasUnsavedChanges(): boolean { return this._state.hasUnsavedChanges; }
    set hasUnsavedChanges(value: boolean) { this._state.hasUnsavedChanges = value; }

    get registry(): GlobalPlayer[] { return this._state.registry; }
    set registry(value: GlobalPlayer[]) { this._state.registry = value; }

    get registryLoaded(): boolean { return this._state.registryLoaded; }
    set registryLoaded(value: boolean) { this._state.registryLoaded = value; }

    // --- Methods ---
    setPlayers(players: Player[]) {
        this._state.players = players;
    }

    setMatchHistory(history: Match[]) {
        this._state.matchHistory = history;
    }

    setKFactor(k: number) {
        this._state.kFactor = k;
    }

    /**
     * Reset the store to initial state.
     * Useful for testing and when exiting a game session.
     */
    reset(keepLibraryHandle: boolean = false): void {
        const libraryHandle = keepLibraryHandle ? this._state.libraryHandle : null;
        const registryLoaded = keepLibraryHandle ? this._state.registryLoaded : false;
        const registry = keepLibraryHandle ? this._state.registry : [];
        
        this._state = {
            ...createInitialState(),
            libraryHandle,
            registryLoaded,
            registry
        };
    }

    /**
     * Get a snapshot of the current state.
     * Useful for debugging and testing.
     */
    getSnapshot(): Readonly<AppState> {
        return { ...this._state };
    }

    /**
     * Restore state from a snapshot.
     * Useful for undo functionality and testing.
     */
    restoreFromSnapshot(snapshot: Partial<AppState>): void {
        this._state = {
            ...this._state,
            ...snapshot
        };
    }

    // --- Singleton pattern (maintained for backward compatibility) ---
    private static instance: AppStore | null = null;

    public static getInstance(): AppStore {
        if (!AppStore.instance) {
            AppStore.instance = new AppStore();
        }
        return AppStore.instance;
    }

    /**
     * Reset the singleton instance.
     * ONLY USE IN TESTS to ensure clean state between test runs.
     */
    public static resetInstance(): void {
        if (AppStore.instance) {
            AppStore.instance.reset();
        }
    }

    /**
     * Replace the singleton instance with a custom one.
     * ONLY USE IN TESTS for dependency injection.
     */
    public static setInstance(instance: AppStore): void {
        AppStore.instance = instance;
    }
}

// Default export for backward compatibility
export const store = AppStore.getInstance();

// Export createInitialState for testing
export { createInitialState };
