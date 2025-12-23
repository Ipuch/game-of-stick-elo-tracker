/**
 * Example game data for demonstration purposes
 * This provides sample players and matches when the app first launches
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { DEFAULT_K_FACTOR } from '../constants/appConstants';
import { generateUUID } from './uuid';
import { AppState } from './localStoragePersistence';

// Sample players with parkour-themed names
const EXAMPLE_PLAYERS: Omit<Player, 'id'>[] = [
    { name: 'Flowmaster', elo: 1450, wins: 12, losses: 4, draws: 1, previousRank: 1, currentStreakType: 'W', currentStreakLength: 3 },
    { name: 'ShadowLeap', elo: 1380, wins: 10, losses: 6, draws: 2, previousRank: 2, currentStreakType: 'W', currentStreakLength: 1 },
    { name: 'IronGrip', elo: 1320, wins: 8, losses: 7, draws: 1, previousRank: 3, currentStreakType: 'L', currentStreakLength: 2 },
    { name: 'VaultKing', elo: 1250, wins: 6, losses: 8, draws: 2, previousRank: 4, currentStreakType: null, currentStreakLength: 0 },
    { name: 'QuickStep', elo: 1100, wins: 3, losses: 10, draws: 1, previousRank: 5, currentStreakType: 'L', currentStreakLength: 4 },
];

/**
 * Creates the example game state with sample players and match history
 */
export function getExampleGameState(): AppState {
    // Generate player IDs
    const players: Player[] = EXAMPLE_PLAYERS.map(p => ({
        ...p,
        id: generateUUID()
    }));

    // Create sample match history
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const matchHistory: Match[] = [
        // Recent matches
        createMatch(players[0], players[1], 'p1', now - DAY * 1),      // Flowmaster beats ShadowLeap
        createMatch(players[0], players[2], 'p1', now - DAY * 2),      // Flowmaster beats IronGrip
        createMatch(players[1], players[3], 'p1', now - DAY * 2),      // ShadowLeap beats VaultKing
        createMatch(players[2], players[4], 'p1', now - DAY * 3),      // IronGrip beats QuickStep
        createMatch(players[0], players[4], 'p1', now - DAY * 4),      // Flowmaster beats QuickStep
        createMatch(players[1], players[2], 'draw', now - DAY * 5),    // ShadowLeap vs IronGrip draw
        createMatch(players[3], players[4], 'p1', now - DAY * 6),      // VaultKing beats QuickStep
        createMatch(players[2], players[3], 'p2', now - DAY * 7),      // VaultKing beats IronGrip
        createMatch(players[1], players[4], 'p1', now - DAY * 8),      // ShadowLeap beats QuickStep
        createMatch(players[0], players[3], 'p1', now - DAY * 9),      // Flowmaster beats VaultKing
        createMatch(players[2], players[1], 'p2', now - DAY * 10),     // ShadowLeap beats IronGrip
        createMatch(players[4], players[3], 'p2', now - DAY * 11),     // VaultKing beats QuickStep
    ];

    return {
        players,
        matchHistory,
        kFactor: DEFAULT_K_FACTOR
    };
}

function createMatch(
    player1: Player,
    player2: Player,
    outcome: 'p1' | 'p2' | 'draw',
    timestamp: number
): Match {
    const eloChange = outcome === 'draw' ? 0 : 15;
    const p1Change = outcome === 'p1' ? eloChange : (outcome === 'draw' ? 0 : -eloChange);
    const p2Change = outcome === 'p2' ? eloChange : (outcome === 'draw' ? 0 : -eloChange);

    return {
        id: generateUUID(),
        player1Id: player1.id,
        player2Id: player2.id,
        player1Name: player1.name,
        player2Name: player2.name,
        player1EloBefore: player1.elo - p1Change,
        player2EloBefore: player2.elo - p2Change,
        player1EloAfter: player1.elo,
        player2EloAfter: player2.elo,
        outcome,
        player1EloChange: p1Change,
        player2EloChange: p2Change,
        timestamp
    };
}

export const EXAMPLE_GAME_NAME = 'EXAMPLE GAME';
