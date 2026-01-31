/**
 * Story Highlights Utility for Game of STICK
 * Shared logic for finding exciting moments (used by Instagram export and Live Display)
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AggregatedPlayer } from './aggregationUtils';
import { t } from './i18n';

// =============================================================================
// TYPES
// =============================================================================

export type HighlightType = 'streak' | 'elo_gain' | 'upset' | 'champion' | 'most_active' | 'top_duel' | 'rank_climb';

export interface StoryHighlight {
    type: HighlightType;
    playerName: string;
    value: number;
    description: string;
    emoji: string;
    opponent?: string;
    secondaryValue?: number; // For additional stats like win rate
    metadata?: any; // Flexible field for custom card rendering
}

// =============================================================================
// HIGHLIGHT FINDERS
// =============================================================================

/**
 * Find the top players with the biggest active win streaks
 */
export function findTopWinStreaks(players: (Player | AggregatedPlayer)[]): StoryHighlight[] {
    const streakPlayers = players
        .filter(p => 'currentStreakType' in p && p.currentStreakType === 'W' && p.currentStreakLength >= 3) // Min 3 for highlight
        .sort((a, b) => {
            const aStreak = 'currentStreakLength' in a ? a.currentStreakLength : 0;
            const bStreak = 'currentStreakLength' in b ? b.currentStreakLength : 0;
            return bStreak - aStreak;
        });

    if (streakPlayers.length === 0) return [];

    const highlights: StoryHighlight[] = [];

    // Top 1
    const top = streakPlayers[0] as Player;
    highlights.push({
        type: 'streak',
        playerName: top.name,
        value: top.currentStreakLength,
        description: `${top.currentStreakLength} ${t('stories.consecutiveWins').toLowerCase()}`,
        emoji: '🔥',
    });

    // Top 2 (if exists and significant)
    if (streakPlayers.length > 1) {
        const second = streakPlayers[1] as Player;
        if (second.currentStreakLength >= 3) {
            highlights.push({
                type: 'streak',
                playerName: second.name,
                value: second.currentStreakLength,
                description: `${second.currentStreakLength} ${t('stories.consecutiveWins').toLowerCase()}`,
                emoji: '🔥', // Same emoji or maybe '🧨'
                metadata: { isSecond: true }
            });
        }
    }

    return highlights;
}

/**
 * Find the player with the biggest rank climb
 */
export function findBiggestRankClimb(
    players: (Player | AggregatedPlayer)[],
    previousRankSnapshot?: Record<string, number>,
    currentRankSnapshot?: Record<string, number>
): StoryHighlight | null {
    if (!previousRankSnapshot || !currentRankSnapshot) return null;

    let bestClimb = 0;
    let bestClimber: Player | AggregatedPlayer | null = null;
    let oldRankVal = 0;
    let newRankVal = 0;

    players.forEach(p => {
        // We need ID to lookup in snapshots
        if (!('id' in p)) return;

        const oldRank = previousRankSnapshot[p.id];
        const newRank = currentRankSnapshot[p.id];

        if (oldRank !== undefined && newRank !== undefined) {
            // Climb means Rank decreased (e.g. 5 -> 2 is a climb of 3)
            const climb = oldRank - newRank;
            if (climb > bestClimb) {
                bestClimb = climb;
                bestClimber = p;
                oldRankVal = oldRank;
                newRankVal = newRank;
            }
        }
    });

    if (!bestClimber || bestClimb < 1) return null; // Min climb of 1 isn't much, let's say min 2? keep 1 for now if small pool

    // Cast to access name property (we know it exists)
    const climberName = (bestClimber as Player).name ?? (bestClimber as AggregatedPlayer).name ?? 'Unknown';

    return {
        type: 'rank_climb',
        playerName: climberName,
        value: bestClimb,
        description: `#${oldRankVal} ➔ #${newRankVal}`,
        emoji: '🚀',
    };
}

/**
 * Find the match with the biggest ELO gain
 */
export function findBiggestEloGain(matches: Match[]): StoryHighlight | null {
    if (matches.length === 0) return null;

    let bestMatch: Match | null = null;
    let bestGain = 0;
    let winnerName = '';
    let loserName = '';

    matches.forEach(match => {
        const p1Change = match.player1EloChange ?? (match.player1EloAfter - match.player1EloBefore);
        const p2Change = match.player2EloChange ?? (match.player2EloAfter - match.player2EloBefore);

        if (p1Change > bestGain) {
            bestGain = p1Change;
            bestMatch = match;
            winnerName = match.player1Name;
            loserName = match.player2Name;
        }
        if (p2Change > bestGain) {
            bestGain = p2Change;
            bestMatch = match;
            winnerName = match.player2Name;
            loserName = match.player1Name;
        }
    });

    if (!bestMatch || bestGain <= 0) return null;

    return {
        type: 'elo_gain',
        playerName: winnerName,
        value: bestGain,
        description: `+${bestGain} ELO in a single match!`,
        emoji: '⚡',
        opponent: loserName,
    };
}

/**
 * Find the biggest upset (lowest expected odds → win)
 */
export function findBiggestUpset(matches: Match[]): StoryHighlight | null {
    if (matches.length === 0) return null;

    let bestUpset: { match: Match; odds: number; winnerName: string; loserName: string } | null = null;

    for (const match of matches) {
        if (match.outcome === 'draw') continue;

        // Calculate expected odds (basic ELO formula)
        const p1Expected = 1 / (1 + Math.pow(10, (match.player2EloBefore - match.player1EloBefore) / 400));
        const p2Expected = 1 - p1Expected;

        const isP1Winner = match.outcome === 'p1';
        const winnerOdds = isP1Winner ? p1Expected : p2Expected;

        if (winnerOdds < 0.4 && (bestUpset === null || winnerOdds < bestUpset.odds)) {
            bestUpset = {
                match,
                odds: winnerOdds,
                winnerName: isP1Winner ? match.player1Name : match.player2Name,
                loserName: isP1Winner ? match.player2Name : match.player1Name,
            };
        }
    }

    if (bestUpset === null) return null;

    const oddsPercent = Math.round(bestUpset.odds * 100);
    return {
        type: 'upset',
        playerName: bestUpset.winnerName,
        value: oddsPercent,
        description: `Beat ${oddsPercent}% odds vs ${bestUpset.loserName}!`,
        emoji: '💀',
        opponent: bestUpset.loserName,
    };
}

/**
 * Find the current champion (top player by ELO)
 */
export function findCurrentChampion(players: (Player | AggregatedPlayer)[]): StoryHighlight | null {
    if (players.length === 0) return null;

    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    const champion = sortedPlayers[0];

    const winRate = champion.wins + champion.losses > 0
        ? Math.round((champion.wins / (champion.wins + champion.losses)) * 100)
        : 0;

    return {
        type: 'champion',
        playerName: champion.name,
        value: champion.elo,
        description: `${champion.wins}W / ${champion.losses}L`,
        emoji: '👑',
        secondaryValue: winRate,
    };
}

/**
 * Find the most active player (most matches played)
 */
export function findMostActive(players: (Player | AggregatedPlayer)[]): StoryHighlight | null {
    if (players.length === 0) return null;

    const sortedByMatches = [...players].sort((a, b) => {
        const aMatches = a.wins + a.losses + a.draws;
        const bMatches = b.wins + b.losses + b.draws;
        return bMatches - aMatches;
    });

    const mostActive = sortedByMatches[0];
    const totalMatches = mostActive.wins + mostActive.losses + mostActive.draws;

    if (totalMatches < 3) return null; // Not enough matches to be notable

    const winRate = mostActive.wins + mostActive.losses > 0
        ? Math.round((mostActive.wins / (mostActive.wins + mostActive.losses)) * 100)
        : 0;

    return {
        type: 'most_active',
        playerName: mostActive.name,
        value: totalMatches,
        description: `${mostActive.wins}W / ${mostActive.losses}L`,
        emoji: '🐕',
        secondaryValue: winRate,
    };
}

/**
 * Find the most recent "Clash of Titans" (Match between Top 3 players)
 */
export function findTopDuel(players: (Player | AggregatedPlayer)[], matches: Match[]): StoryHighlight | null {
    if (players.length < 2) return null;

    // 1. Identify Top Players (e.g. Top 3)
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    const topPlayers = sortedPlayers.slice(0, 3);
    const topPlayerIds = new Set(topPlayers.map(p => 'id' in p ? p.id : null).filter(Boolean));

    // 2. Find most recent match between two Top Players
    // Clone and reverse to iterate newest first
    const recentMatches = [...matches].sort((a, b) => b.timestamp - a.timestamp);

    let titanMatch: Match | null = null;

    for (const match of recentMatches) {
        if (topPlayerIds.has(match.player1Id) && topPlayerIds.has(match.player2Id)) {
            titanMatch = match;
            break;
        }
    }

    // 3. If found, return THAT match as the highlight
    if (titanMatch) {
        const p1 = players.find(p => 'id' in p && p.id === titanMatch!.player1Id);
        const p2 = players.find(p => 'id' in p && p.id === titanMatch!.player2Id);

        if (p1 && p2) {
            const firstWasPlayer1 = true; // Relative to the match object structure

            // Outcome Logic
            let winnerName = null;
            let outcomeType = 'draw';
            let eloGain = 0;
            let description = '';

            if (titanMatch.outcome === 'draw') {
                description = t('match.draw');
            } else {
                const p1Won = titanMatch.outcome === 'p1';
                winnerName = p1Won ? titanMatch.player1Name : titanMatch.player2Name;
                outcomeType = 'win';

                // Calculate Gain
                if (p1Won) {
                    eloGain = Math.abs(titanMatch.player1EloAfter - titanMatch.player1EloBefore);
                } else {
                    eloGain = Math.abs(titanMatch.player2EloAfter - titanMatch.player2EloBefore);
                }
                description = `${t('liveDisplay.lastDuel')}: ${winnerName} +${eloGain}`;
            }

            return {
                type: 'top_duel',
                playerName: p1.name,
                value: titanMatch.player1EloBefore, // Initial ELO context
                description,
                emoji: '⚔️',
                opponent: p2.name,
                secondaryValue: titanMatch.player2EloBefore, // Initial ELO context
                metadata: {
                    p1Initial: titanMatch.player1EloBefore,
                    p2Initial: titanMatch.player2EloBefore,
                    winner: winnerName,
                    outcome: outcomeType,
                    eloGain
                }
            };
        }
    }

    // 4. FALLBACK: If no recent titan match, show the #1 vs #2 Scenario (Hypothetical)
    // Only if they are close in ELO
    const first = sortedPlayers[0];
    const second = sortedPlayers[1];

    if ((first.elo - second.elo) > 150) return null; // Not a clash if gap is huge

    return {
        type: 'top_duel',
        playerName: first.name,
        value: first.elo,
        description: `#1 vs #2`,
        emoji: '⚔️',
        opponent: second.name,
        secondaryValue: second.elo,
        metadata: {
            p1Initial: first.elo,
            p2Initial: second.elo,
            // No winner/outcome
        }
    };
}

/**
 * Collect all available highlights for the current game state
 */
export function collectAllHighlights(
    players: (Player | AggregatedPlayer)[],
    matches: Match[],
    previousRankSnapshot?: Record<string, number>,
    currentRankSnapshot?: Record<string, number>
): StoryHighlight[] {
    const highlights: StoryHighlight[] = [];

    // 1. Champion
    const champion = findCurrentChampion(players);
    if (champion) highlights.push(champion);

    // 2. Win Streaks (Top 1 and possibly Top 2)
    const streaks = findTopWinStreaks(players);
    highlights.push(...streaks);

    // 3. Biggest Rank Climb
    const rankClimb = findBiggestRankClimb(players, previousRankSnapshot, currentRankSnapshot);
    if (rankClimb) highlights.push(rankClimb);

    // 4. Biggest ELO Gain
    const eloGain = findBiggestEloGain(matches);
    if (eloGain) highlights.push(eloGain);

    // 5. Upset
    const upset = findBiggestUpset(matches);
    if (upset) highlights.push(upset);

    // 6. Most Active
    const mostActive = findMostActive(players);
    if (mostActive) highlights.push(mostActive);

    // 7. Top Duel
    const topDuel = findTopDuel(players, matches);
    if (topDuel) highlights.push(topDuel);

    return highlights;
}

/**
 * Backwards compatibility wrapper for findTopWinStreaks
 * Returns the single biggest win streak highlight (or null)
 */
export function findBiggestWinStreak(players: (Player | AggregatedPlayer)[]): StoryHighlight | null {
    const streaks = findTopWinStreaks(players);
    return streaks.length > 0 ? streaks[0] : null;
}
