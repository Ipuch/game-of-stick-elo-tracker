/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { GlobalPlayer } from '../types/registryTypes';
import { DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';

export class AppStore {
    players: Player[] = [];
    matchHistory: Match[] = [];
    kFactor: number = DEFAULT_ELO_CONFIG.parameters.kFactor;
    isRealtimeUpdate: boolean = true; // Kept for compatibility but always true
    
    // Two-snapshot system for diff display:
    // - previousLeaderboardElo: baseline from the Update BEFORE the last one
    // - lastLeaderboardElo: baseline from the most recent Update
    // Diff shown = lastLeaderboardElo - previousLeaderboardElo
    previousLeaderboardElo: Record<string, number> = {};
    lastLeaderboardElo: Record<string, number> = {};
    
    // Same two-snapshot system for ranks:
    // - previousLeaderboardRanks: ranks from Update BEFORE the last one
    // - lastLeaderboardRanks: ranks from most recent Update (displayed rank)
    // Rank diff = lastLeaderboardRanks - previousLeaderboardRanks
    previousLeaderboardRanks: Record<string, number> = {};
    lastLeaderboardRanks: Record<string, number> = {};
    
    currentSessionId: string | null = null;
    directoryHandle: FileSystemDirectoryHandle | null = null; // Used for "Library" mode
    libraryHandle: FileSystemDirectoryHandle | null = null; // Add library handle
    folderName: string | null = null;
    hasUnsavedChanges: boolean = false;

    // --- Player Registry ---
    registry: GlobalPlayer[] = [];
    registryLoaded: boolean = false;

    setPlayers(players: Player[]) {
        this.players = players;
    }

    setMatchHistory(history: Match[]) {
        this.matchHistory = history;
    }

    setKFactor(k: number) {
        this.kFactor = k;
    }

    // Singleton pattern
    private static instance: AppStore;
    private constructor() { }

    public static getInstance(): AppStore {
        if (!AppStore.instance) {
            AppStore.instance = new AppStore();
        }
        return AppStore.instance;
    }
}

export const store = AppStore.getInstance();
