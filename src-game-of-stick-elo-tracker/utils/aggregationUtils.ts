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

export interface TimeSegment {
    id: string;
    label: string;
    start: Date;
    end: Date;
    type: 'month' | 'year' | 'all';
}

/**
 * Generate available time segments from matches
 */
export function generateTimeSegments(matches: Match[]): TimeSegment[] {
    if (matches.length === 0) {
        return [{
            id: 'all',
            label: 'All Time',
            start: new Date(0),
            end: new Date(8640000000000000), // Max date
            type: 'all'
        }];
    }

    const segments: TimeSegment[] = [];
    const timestamps = matches.map(m => m.timestamp);
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    // 1. All Time
    segments.push({
        id: 'all',
        label: 'All Time',
        start: new Date(0),
        end: new Date(8640000000000000),
        type: 'all'
    });

    // 2. Years
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    for (let year = endYear; year >= startYear; year--) {
        segments.push({
            id: `year-${year}`,
            label: `${year}`, // "2025"
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
            type: 'year'
        });
    }

    // 3. Months
    // Iterate month by month backwards from maxDate to minDate
    let current = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const stop = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    while (current >= stop) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const monthName = current.toLocaleString('default', { month: 'long' });

        // Check if there are matches in this month
        const nextMonth = new Date(year, month + 1, 1);
        const hasMatches = matches.some(m => {
            const d = new Date(m.timestamp);
            return d >= current && d < nextMonth;
        });

        if (hasMatches) {
            segments.push({
                id: `month-${year}-${month}`,
                label: `${monthName} ${year}`, // "December 2025"
                start: new Date(current),
                end: new Date(year, month + 1, 0, 23, 59, 59, 999), // End of month
                type: 'month'
            });
        }

        // Previous month
        current = new Date(year, month - 1, 1);
    }

    return segments;
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
    range: { start: Date; end: Date }
): AggregatedStats {
    // Filter matches by date range
    const filteredMatches = matches.filter(m => {
        const d = new Date(m.timestamp);
        return d >= range.start && d <= range.end;
    });

    // Sort by timestamp (oldest first) for correct ELO calculation
    const sortedMatches = [...filteredMatches].sort((a, b) => a.timestamp - b.timestamp);

    // Build player map (normalized name -> player data)
    const playerMap = new Map<string, AggregatedPlayer>();
    const players: AggregatedPlayer[] = []; // Explicit list to maintain order if needed

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
                eloHistory: [{ timestamp: range.start.getTime(), elo: initialElo }]
            });
            players.push(playerMap.get(normalized)!);
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

    // Sort players by ELO (descending)
    players.sort((a, b) => b.elo - a.elo);

    // Collect unique game names from filtered matches
    const gameNamesInRange = [...new Set(sortedMatches.map(m => (m as any).gameName || 'Unknown'))];

    return {
        players,
        matches: sortedMatches,  // Include filtered matches
        totalMatches: sortedMatches.length,
        totalGames: gameNamesInRange.length,
        gameNames: gameNamesInRange,
        dateRange: range
    };
}

/**
 * Main entry point: Load and aggregate stats from a library with time filter
 */
export async function getAggregatedStats(
    libraryHandle: FileSystemDirectoryHandle,
    range: { start: Date; end: Date }
): Promise<AggregatedStats> {
    const { matches, gameNames } = await loadAllMatchesFromLibrary(libraryHandle);
    const stats = aggregatePlayerStats(matches, range);

    // Include all game names that were loaded (even if no matches in range)
    if (stats.gameNames.length === 0 && gameNames.length > 0) {
        stats.gameNames = gameNames;
    }

    return stats;
}
