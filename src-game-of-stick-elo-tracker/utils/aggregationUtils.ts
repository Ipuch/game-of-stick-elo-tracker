/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Cross-Game Aggregation Utilities
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Match } from '../types/appTypes';
import { loadGameFromSession, listGamesInLibrary } from './fileSystemPersistence';
import { DEFAULT_ELO_CONFIG, EloScoringSystem } from '../scoring/eloScoring';

export interface AggregatedPlayer {
    name: string;              // Canonical display name
    normalizedName: string;    // Lowercased for matching
    matchCount: number;
    wins: number;
    losses: number;
    draws: number;
    elo: number;               // Cumulative ELO from filtered matches
    gamesParticipated: string[];  // Game folder names
    eloHistory: { timestamp: number; elo: number }[];
}

export interface AggregatedStats {
    players: AggregatedPlayer[];
    matches: Match[];           // Filtered matches for match history and chart
    totalMatches: number;
    totalGames: number;
    gameNames: string[];
    dateRange: { start: Date; end: Date };
}

export type TimeFilter = 'month' | '3months' | 'year' | 'all';

/**
 * Get the start date for a given time filter
 */
export function getFilterStartDate(filter: TimeFilter): Date {
    const now = new Date();
    switch (filter) {
        case 'month':
            return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case '3months':
            return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        case 'year':
            return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case 'all':
        default:
            return new Date(0); // Beginning of time
    }
}

/**
 * Normalize a player name for matching (lowercase, trimmed)
 */
function normalizeName(name: string): string {
    return name.toLowerCase().trim();
}

/**
 * Load all matches from all games in a library
 */
export async function loadAllMatchesFromLibrary(
    libraryHandle: FileSystemDirectoryHandle
): Promise<{ matches: Match[]; gameNames: string[] }> {
    const games = await listGamesInLibrary(libraryHandle);
    const allMatches: Match[] = [];
    const gameNames: string[] = [];

    for (const game of games) {
        try {
            const state = await loadGameFromSession(game.handle);
            // Tag each match with the game name for tracking
            state.matchHistory.forEach(match => {
                (match as any).gameName = game.name;
            });
            allMatches.push(...state.matchHistory);
            gameNames.push(game.name);
        } catch (e) {
            console.warn(`Failed to load game "${game.name}":`, e);
        }
    }

    return { matches: allMatches, gameNames };
}

/**
 * Aggregate player stats from a list of matches
 * Players are matched by normalized name (case-insensitive)
 * ELO is recalculated from scratch based on match order
 */
export function aggregatePlayerStats(
    matches: Match[],
    since: Date
): AggregatedStats {
    // Filter matches by date
    const filteredMatches = matches.filter(m => new Date(m.timestamp) >= since);

    // Sort by timestamp (oldest first) for correct ELO calculation
    const sortedMatches = [...filteredMatches].sort((a, b) => a.timestamp - b.timestamp);

    // Build player map (normalized name -> player data)
    const playerMap = new Map<string, AggregatedPlayer>();

    const eloSystem = new EloScoringSystem();
    const initialElo = DEFAULT_ELO_CONFIG.initialRating;

    // Helper to get or create player
    function getPlayer(name: string, gameName: string): AggregatedPlayer {
        const normalized = normalizeName(name);
        if (!playerMap.has(normalized)) {
            playerMap.set(normalized, {
                name: name, // Use first seen name as canonical
                normalizedName: normalized,
                matchCount: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                elo: initialElo,
                gamesParticipated: [],
                eloHistory: [{ timestamp: 0, elo: initialElo }]
            });
        }
        const player = playerMap.get(normalized)!;
        // Track game participation
        if (!player.gamesParticipated.includes(gameName)) {
            player.gamesParticipated.push(gameName);
        }
        return player;
    }

    // Process each match chronologically
    for (const match of sortedMatches) {
        const gameName = (match as any).gameName || 'Unknown';
        const p1 = getPlayer(match.player1Name, gameName);
        const p2 = getPlayer(match.player2Name, gameName);

        // Calculate ELO change
        const result = eloSystem.calculateNewRatings(
            p1.elo,
            p2.elo,
            match.outcome
        );

        // Update stats
        p1.matchCount++;
        p2.matchCount++;

        if (match.outcome === 'p1') {
            p1.wins++;
            p2.losses++;
        } else if (match.outcome === 'p2') {
            p1.losses++;
            p2.wins++;
        } else {
            p1.draws++;
            p2.draws++;
        }

        // Update ELO
        p1.elo = result.newP1Rating;
        p2.elo = result.newP2Rating;

        // Track ELO history
        p1.eloHistory.push({ timestamp: match.timestamp, elo: p1.elo });
        p2.eloHistory.push({ timestamp: match.timestamp, elo: p2.elo });
    }

    // Convert to array and sort by ELO descending
    const players = Array.from(playerMap.values())
        .sort((a, b) => b.elo - a.elo);

    // Determine date range
    const timestamps = sortedMatches.map(m => m.timestamp);
    const dateRange = {
        start: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(),
        end: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date()
    };

    // Collect unique game names from filtered matches
    const gameNamesInRange = [...new Set(sortedMatches.map(m => (m as any).gameName || 'Unknown'))];

    return {
        players,
        matches: sortedMatches,  // Include filtered matches
        totalMatches: sortedMatches.length,
        totalGames: gameNamesInRange.length,
        gameNames: gameNamesInRange,
        dateRange
    };
}

/**
 * Main entry point: Load and aggregate stats from a library with time filter
 */
export async function getAggregatedStats(
    libraryHandle: FileSystemDirectoryHandle,
    filter: TimeFilter
): Promise<AggregatedStats> {
    const { matches, gameNames } = await loadAllMatchesFromLibrary(libraryHandle);
    const since = getFilterStartDate(filter);
    const stats = aggregatePlayerStats(matches, since);

    // Include all game names that were loaded (even if no matches in range)
    if (stats.gameNames.length === 0 && gameNames.length > 0) {
        stats.gameNames = gameNames;
    }

    return stats;
}
