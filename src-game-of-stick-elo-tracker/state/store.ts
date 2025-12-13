import { Player, Match } from '../types/appTypes';
import { DEFAULT_K_FACTOR } from '../constants/appConstants';

export class AppStore {
    players: Player[] = [];
    matchHistory: Match[] = [];
    kFactor: number = DEFAULT_K_FACTOR;
    isRealtimeUpdate: boolean = true; // Kept for compatibility but always true
    lastLeaderboardElo: Record<string, number> = {};
    currentSessionId: string | null = null;
    directoryHandle: FileSystemDirectoryHandle | null = null; // Used for "Library" mode
    libraryHandle: FileSystemDirectoryHandle | null = null; // Add library handle
    folderName: string | null = null;
    hasUnsavedChanges: boolean = false;

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
