import { Player, Match } from '../types/appTypes';
import { INITIAL_ELO, PLAYERS_STORAGE_KEY, MATCH_HISTORY_STORAGE_KEY, SETTINGS_STORAGE_KEY, DEFAULT_K_FACTOR } from '../constants/appConstants';

export interface AppState {
  players: Player[];
  matchHistory: Match[];
  kFactor: number;
  isRealtimeUpdate: boolean;
}

export function saveAppState({ players, matchHistory, kFactor, isRealtimeUpdate }: AppState) {
  try {
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
    localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(matchHistory));
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ kFactor, isRealtimeUpdate }));
  } catch (e) {
    console.error('Failed to save app state:', e);
  }
}

export function loadAppState(): AppState {
  let players: Player[] = [];
  let matchHistory: Match[] = [];
  let kFactor: number = DEFAULT_K_FACTOR;
  let isRealtimeUpdate: boolean = true;

  try {
    const storedPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
    if (storedPlayers) {
      const parsedPlayers: Player[] = JSON.parse(storedPlayers);
      players = parsedPlayers.map(p => ({
        ...p,
        wins: typeof p.wins === 'number' ? p.wins : 0,
        losses: typeof p.losses === 'number' ? p.losses : 0,
        draws: typeof p.draws === 'number' ? p.draws : 0,
        previousRank: typeof p.previousRank === 'number' ? p.previousRank : 0,
        currentStreakType: p.currentStreakType ?? null,
        currentStreakLength: typeof p.currentStreakLength === 'number' ? p.currentStreakLength : 0,
      }));
    }
    const storedMatchHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    if (storedMatchHistory) {
      matchHistory = JSON.parse(storedMatchHistory);
    }
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      kFactor = typeof settings.kFactor === 'number' ? settings.kFactor : DEFAULT_K_FACTOR;
      isRealtimeUpdate = settings.isRealtimeUpdate ?? true;
    }
  } catch (e) {
    console.error('Failed to load app state, using defaults:', e);
  }

  return { players, matchHistory, kFactor, isRealtimeUpdate };
}

export function clearAppState() {
  try {
    localStorage.removeItem(PLAYERS_STORAGE_KEY);
    localStorage.removeItem(MATCH_HISTORY_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear app state:', e);
  }
} 