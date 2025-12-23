/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match, GameSessionMetadata } from '../types/appTypes';
import { INITIAL_ELO, PLAYERS_STORAGE_KEY, MATCH_HISTORY_STORAGE_KEY, SETTINGS_STORAGE_KEY, DEFAULT_K_FACTOR, LAST_LIBRARY_NAME_KEY } from '../constants/appConstants';
import { generateUUID } from './uuid';

const SESSION_LIST_KEY = 'game-of-stick-sessions';

export interface AppState {
  players: Player[];
  matchHistory: Match[];
  kFactor: number;
  // isRealtimeUpdate removed from logic as it is always true now
}

export function getSessionList(): GameSessionMetadata[] {
  try {
    const listStr = localStorage.getItem(SESSION_LIST_KEY);
    if (listStr) {
      return JSON.parse(listStr);
    }
  } catch (e) {
    console.error('Failed to load session list', e);
  }
  return [];
}

function saveSessionList(list: GameSessionMetadata[]) {
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list));
}

export function createSession(name: string, kFactor: number = DEFAULT_K_FACTOR): string {
  const id = generateUUID();
  const now = Date.now();
  const metadata: GameSessionMetadata = {
    id,
    name,
    createdAt: now,
    lastPlayed: now,
    playerCount: 0,
    kFactor
  };

  const list = getSessionList();
  list.unshift(metadata);
  saveSessionList(list);

  // Initialize empty state
  saveSession(id, { players: [], matchHistory: [], kFactor });

  return id;
}

export function migrateLegacyDataIfNeeded(): string | null {
  // Check if legacy data exists and not already migrated (we don't strictly track if migrated, 
  // but we can check if SESSION_LIST is empty and legacy data exists).
  // Better: Check if key exists.
  const legacyPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
  if (!legacyPlayers) return null; // No legacy data

  // Check if we already have a "Legacy Game" (simple check)
  const list = getSessionList();
  const alreadyMigrated = list.some(s => s.name === 'Legacy Game');
  if (alreadyMigrated) return null;

  console.log("Migrating legacy data...");

  // Load Legacy Data safely
  let players: Player[] = [];
  let matchHistory: Match[] = [];
  let kFactor = DEFAULT_K_FACTOR;

  try {
    players = JSON.parse(legacyPlayers);
    const hist = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    if (hist) matchHistory = JSON.parse(hist);
    const settings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (settings) {
      const s = JSON.parse(settings);
      if (s.kFactor) kFactor = s.kFactor;
    }
  } catch (e) {
    console.error("Error reading legacy data", e);
  }

  // Create Session
  const id = generateUUID();
  const now = Date.now();
  const metadata: GameSessionMetadata = {
    id,
    name: 'Legacy Game',
    createdAt: now,
    lastPlayed: now,
    playerCount: players.length,
    kFactor
  };

  list.push(metadata);
  saveSessionList(list);
  saveSession(id, { players, matchHistory, kFactor });

  // Optional: Clear legacy keys? For safety, let's keep them for now or rename.
  // localStorage.removeItem(PLAYERS_STORAGE_KEY); 

  return id;
}

export function saveSession(id: string, state: AppState) {
  const key = `session_${id}`;
  const data = {
    players: state.players,
    matchHistory: state.matchHistory,
    kFactor: state.kFactor
  };
  try {
    localStorage.setItem(key, JSON.stringify(data));

    // Update Metadata (lastPlayed, playerCount)
    const list = getSessionList();
    const sessionIndex = list.findIndex(s => s.id === id);
    if (sessionIndex !== -1) {
      list[sessionIndex].lastPlayed = Date.now();
      list[sessionIndex].playerCount = state.players.length;
      list[sessionIndex].kFactor = state.kFactor;
      // Move to top
      const session = list.splice(sessionIndex, 1)[0];
      list.unshift(session);
      saveSessionList(list);
    }
  } catch (e) {
    console.error(`Failed to save session ${id}`, e);
  }
}

export function loadSession(id: string): AppState | null {
  const key = `session_${id}`;
  try {
    const str = localStorage.getItem(key);
    if (!str) return null;
    const data = JSON.parse(str);

    // Sanitize
    const players = (data.players || []).map((p: any) => ({
      ...p,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      draws: p.draws ?? 0,
      previousRank: p.previousRank ?? 0,
      currentStreakType: p.currentStreakType ?? null,
      currentStreakLength: p.currentStreakLength ?? 0,
    }));

    return {
      players,
      matchHistory: data.matchHistory || [],
      kFactor: data.kFactor || DEFAULT_K_FACTOR
    };
  } catch (e) {
    console.error(`Failed to load session ${id}`, e);
    return null;
  }
}

// Deprecated single-load wrapper for backward compatibility or simple testing
export function loadAppState(): AppState {
  // This function shouldn't really be used directly anymore in the new architecture
  // identifying "current" session is done via URL hash in index.tsx
  return { players: [], matchHistory: [], kFactor: 60 };
}

// --- Library Directory Name Persistence ---

/**
 * Save the last used library directory name for UI hints on re-launch
 */
export function saveLastLibraryName(name: string): void {
  localStorage.setItem(LAST_LIBRARY_NAME_KEY, name);
}

/**
 * Get the last used library directory name (for hint on launch)
 */
export function getLastLibraryName(): string | null {
  return localStorage.getItem(LAST_LIBRARY_NAME_KEY);
}

/**
 * Clear all temporary localStorage data (sessions, settings, etc.)
 * Called when saving to a folder to clean up temporary browser storage
 */
export function clearTemporaryData(): void {
  // Remove all session data
  const sessionList = getSessionList();
  sessionList.forEach(session => {
    localStorage.removeItem(`session_${session.id}`);
  });

  // Remove session list
  localStorage.removeItem(SESSION_LIST_KEY);

  // Remove legacy data
  localStorage.removeItem(PLAYERS_STORAGE_KEY);
  localStorage.removeItem(MATCH_HISTORY_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_STORAGE_KEY);

  // Note: We keep LAST_LIBRARY_NAME_KEY for re-launch hint
}