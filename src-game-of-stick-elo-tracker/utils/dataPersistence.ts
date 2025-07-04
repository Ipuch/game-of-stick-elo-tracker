import { Player, Match } from '../types/appTypes';
import { INITIAL_ELO, PLAYERS_STORAGE_KEY, MATCH_HISTORY_STORAGE_KEY, SETTINGS_STORAGE_KEY, DEFAULT_K_FACTOR } from '../constants/appConstants';

export function saveState(
  players: Player[],
  matchHistory: Match[],
  kFactor: number,
  isRealtimeUpdate: boolean
) {
  localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
  localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(matchHistory));
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ kFactor, isRealtimeUpdate }));
}

export function loadState(): {
  players: Player[];
  matchHistory: Match[];
  kFactor: number;
  isRealtimeUpdate: boolean;
} {
  const storedPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
  let players: Player[] = [];
  if (storedPlayers) {
    const parsedPlayers: Player[] = JSON.parse(storedPlayers);
    players = parsedPlayers.map(p => ({
        ...p,
        wins: p.wins || 0,
        losses: p.losses || 0,
        draws: p.draws || 0,
        previousRank: p.previousRank || 0,
        currentStreakType: p.currentStreakType || null,
        currentStreakLength: p.currentStreakLength || 0,
    }));
  }

  const storedMatchHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
  let matchHistory: Match[] = [];
  if(storedMatchHistory) {
      matchHistory = JSON.parse(storedMatchHistory);
  }

  const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
  let kFactor: number = DEFAULT_K_FACTOR;
  let isRealtimeUpdate: boolean = true;
  if (storedSettings) {
    const settings = JSON.parse(storedSettings);
    kFactor = settings.kFactor || DEFAULT_K_FACTOR;
    isRealtimeUpdate = settings.isRealtimeUpdate ?? true;
  }
  
  return { players, matchHistory, kFactor, isRealtimeUpdate };
} 