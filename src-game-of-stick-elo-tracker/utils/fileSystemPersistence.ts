
import { AppState } from './localStoragePersistence';
import { Player, Match } from '../types/appTypes';
import { DEFAULT_K_FACTOR } from '../constants/appConstants';
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

// 4. LOAD GAME (From Subfolder, CSV based)
export async function loadGameFromSession(dirHandle: FileSystemDirectoryHandle): Promise<AppState> {
    let players: Player[] = [];
    let matchHistory: Match[] = [];
    let kFactor = DEFAULT_K_FACTOR;

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
        await writeFile(PLAYERS_FILE_CSV, playersToCSV(state.players));

        // Write Matches
        await writeFile(MATCHES_FILE_CSV, matchesToCSV(state.matchHistory));

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

// Deprecated single-folder helpers maintained for compatibility if needed, but we essentially replace usage
export const selectGameFolder = selectLibraryFolder;
export const loadGameFromFolder = loadGameFromSession;
export const saveGameToFolder = saveGameToSession;
