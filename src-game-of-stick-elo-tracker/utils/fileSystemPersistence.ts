/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { AppState } from './localStoragePersistence';
import { Player, Match } from '../types/appTypes';
import { DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';
import { playersToCSV, matchesToCSV, csvToPlayers, csvToMatches } from './csvUtils';

// Extending Window interface for File System Access API
declare global {
    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    }
}

// File names
const PLAYERS_FILE_CSV = 'players.csv';
const MATCHES_FILE_CSV = 'matches.csv';
const METADATA_FILE = 'metadata.json';

export interface GameSessionHandle {
    name: string;
    handle: FileSystemDirectoryHandle;
}

// 1. SELECT LIBRARY FOLDER (Root)
export async function selectLibraryFolder(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const dirHandle = await window.showDirectoryPicker();
        return dirHandle;
    } catch (error) {
        if ((error as Error).name === 'AbortError') return null;
        console.error('Error selecting folder:', error);
        throw error;
    }
}

// 2. LIST GAMES (Subfolders)
export async function listGamesInLibrary(libraryHandle: FileSystemDirectoryHandle): Promise<GameSessionHandle[]> {
    const games: GameSessionHandle[] = [];
    // @ts-ignore - async iterator TS support might be missing in older lib targets
    for await (const entry of libraryHandle.values()) {
        if (entry.kind === 'directory') {
            // Filter out hidden folders (like .temp)
            if (entry.name.startsWith('.')) continue;

            games.push({
                name: entry.name,
                handle: entry as FileSystemDirectoryHandle
            });
        }
    }
    return games;
}

// 3. CREATE NEW GAME (Subfolder)
export async function createGameInLibrary(libraryHandle: FileSystemDirectoryHandle, gameName: string): Promise<FileSystemDirectoryHandle> {
    const gameDir = await libraryHandle.getDirectoryHandle(gameName, { create: true });
    return gameDir;
}

export interface GameQuickStats {
    playerCount: number;
    matchCount: number;
    lastMatchDate: number | null;
    createdDate?: number; // Approximate from first match
}

export async function getGameQuickStats(dirHandle: FileSystemDirectoryHandle): Promise<GameQuickStats> {
    let stats: GameQuickStats = {
        playerCount: 0,
        matchCount: 0,
        lastMatchDate: null
    };

    try {
        // Count Players
        try {
            const playersHandle = await dirHandle.getFileHandle(PLAYERS_FILE_CSV);
            const file = await playersHandle.getFile();
            const text = await file.text();
            // Subtract 1 for header, ensure not negative if empty file
            const lineCount = text.trim().split('\n').length;
            stats.playerCount = Math.max(0, lineCount - 1);
        } catch (e) { /* ignore */ }

        // Count Matches & dates
        try {
            const matchesHandle = await dirHandle.getFileHandle(MATCHES_FILE_CSV);
            const file = await matchesHandle.getFile();
            const text = await file.text();
            const matches = csvToMatches(text);
            stats.matchCount = matches.length;

            if (matches.length > 0) {
                const timestamps = matches.map(m => m.timestamp);
                stats.lastMatchDate = Math.max(...timestamps);
                stats.createdDate = Math.min(...timestamps);
            }
        } catch (e) { /* ignore */ }

    } catch (e) {
        console.warn('Failed to get quick stats', e);
    }
    return stats;
}

// 4. LOAD GAME (From Subfolder, CSV based)
export async function loadGameFromSession(dirHandle: FileSystemDirectoryHandle): Promise<AppState> {
    let players: Player[] = [];
    let matchHistory: Match[] = [];
    let kFactor = DEFAULT_ELO_CONFIG.parameters.kFactor;

    try {
        // Load Players (CSV)
        try {
            const playersHandle = await dirHandle.getFileHandle(PLAYERS_FILE_CSV);
            const file = await playersHandle.getFile();
            const text = await file.text();
            players = csvToPlayers(text);
        } catch (e) {
            console.log('players.csv not found or invalid, starting empty.');
        }

        // Load Matches (CSV)
        try {
            const matchesHandle = await dirHandle.getFileHandle(MATCHES_FILE_CSV);
            const file = await matchesHandle.getFile();
            const text = await file.text();
            matchHistory = csvToMatches(text);
        } catch (e) {
            console.log('matches.csv not found or invalid, starting empty.');
        }

        // Load Metadata/Settings (JSON)
        try {
            const metaHandle = await dirHandle.getFileHandle(METADATA_FILE);
            const file = await metaHandle.getFile();
            const text = await file.text();
            const meta = JSON.parse(text);
            if (typeof meta.kFactor === 'number') {
                kFactor = meta.kFactor;
            }
        } catch (e) {
            console.log('metadata.json not found, using default settings.');
        }

    } catch (error) {
        console.error('Error loading game from folder:', error);
        throw error;
    }

    return {
        players,
        matchHistory,
        kFactor
    };
}

// 5. SAVE GAME (To Subfolder, CSV based)
export async function saveGameToSession(dirHandle: FileSystemDirectoryHandle, state: AppState): Promise<void> {
    try {
        // Helper to write file
        const writeFile = async (filename: string, content: string) => {
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        };

        // Write Players
        const playersCSV = playersToCSV(state.players);
        await writeFile(PLAYERS_FILE_CSV, playersCSV);

        // Write Matches
        const matchesCSV = matchesToCSV(state.matchHistory);
        await writeFile(MATCHES_FILE_CSV, matchesCSV);

        // Write Metadata
        const metadata = {
            kFactor: state.kFactor,
            lastSaved: Date.now(),
            version: '2.0' // Bumped version for CSV support
        };
        await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));

    } catch (error) {
        console.error('Error saving game to folder:', error);
        throw error;
    }
}

// --- CRASH RECOVERY / TEMP BACKUP SYSTEM ---

const TEMP_FOLDER_NAME = '.temp';

/**
 * Ensures the .temp folder exists within the library root or game folder.
 * NOTE: We ideally want this in the LIBRARY root to separate it from specific game folders if possible,
 * but for simplicity/safety we might put it inside the game folder to ensure we have write access.
 * 
 * However, the requirement is "saved_games/.temp/name_of_the_game".
 * This implies the .temp folder is a sibling of game folders, inside the library root.
 */
async function getTempFolder(libraryHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
    return await libraryHandle.getDirectoryHandle(TEMP_FOLDER_NAME, { create: true });
}

/**
 * Saves a backup of the current game state to saved_games/.temp/backup_<GameName>.json
 * This is called automatically on changes.
 */
export async function saveTempBackup(libraryHandle: FileSystemDirectoryHandle, gameName: string, state: AppState): Promise<void> {
    try {
        const tempDir = await getTempFolder(libraryHandle);
        const timestamp = Date.now();
        const backupFilename = `backup_${gameName}.json`;

        // We save as JSON for the backup because it's a single atomic write, 
        // unlike the CSV spread which requires 3 files. Atomicity is better for crash protection.
        const backupData = {
            timestamp,
            gameName,
            state
        };

        const fileHandle = await tempDir.getFileHandle(backupFilename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(backupData));
        await writable.close();

    } catch (e) {
        // Silently fail or log warning - backup failure shouldn't crash the game
        console.warn('Failed to save temp backup:', e);
    }
}

/**
 * Checks if a backup exists for this game.
 * Returns the backup data if it exists.
 */
export async function loadTempBackup(libraryHandle: FileSystemDirectoryHandle, gameName: string): Promise<{ timestamp: number, state: AppState } | null> {
    try {
        const tempDir = await libraryHandle.getDirectoryHandle(TEMP_FOLDER_NAME, { create: false });
        const backupFilename = `backup_${gameName}.json`;

        const fileHandle = await tempDir.getFileHandle(backupFilename);
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        return {
            timestamp: data.timestamp,
            state: data.state
        };

    } catch (e) {
        // No backup found or invalid
        return null;
    }
}

/**
 * Deletes the backup file for a specific game.
 * Called after a successful manual save.
 */
export async function deleteTempBackup(libraryHandle: FileSystemDirectoryHandle, gameName: string): Promise<void> {
    try {
        const tempDir = await libraryHandle.getDirectoryHandle(TEMP_FOLDER_NAME, { create: false });
        const backupFilename = `backup_${gameName}.json`;
        await tempDir.removeEntry(backupFilename);
    } catch (e) {
        // Ignore if file doesn't exist
    }
}

// Deprecated single-folder helpers maintained for compatibility if needed, but we essentially replace usage
export const selectGameFolder = selectLibraryFolder;
export const loadGameFromFolder = loadGameFromSession;
export const saveGameToFolder = saveGameToSession;

