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

export type HighlightType = 'streak' | 'elo_gain' | 'upset' | 'champion' | 'most_active' | 'top_duel';

export interface StoryHighlight {
    type: HighlightType;
    playerName: string;
    value: number;
    description: string;
    emoji: string;
    opponent?: string;
    secondaryValue?: number; // For additional stats like win rate
}

// =============================================================================
// HIGHLIGHT FINDERS
// =============================================================================

/**
 * Find the player with the biggest active win streak
 */
export function findBiggestWinStreak(players: (Player | AggregatedPlayer)[]): StoryHighlight | null {
    const streakPlayers = players
        .filter(p => 'currentStreakType' in p && p.currentStreakType === 'W' && p.currentStreakLength >= 2)
        .sort((a, b) => {
            const aStreak = 'currentStreakLength' in a ? a.currentStreakLength : 0;
            const bStreak = 'currentStreakLength' in b ? b.currentStreakLength : 0;
            return bStreak - aStreak;
        });

    if (streakPlayers.length === 0) return null;

    const top = streakPlayers[0] as Player;
    return {
        type: 'streak',
        playerName: top.name,
        value: top.currentStreakLength,
        description: `${top.currentStreakLength}-win streak!`,
        emoji: '🔥',
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
 * Find potential top duel (closest ELO between top 2 players)
 */
export function findTopDuel(players: (Player | AggregatedPlayer)[], matches: Match[]): StoryHighlight | null {
    if (players.length < 2) return null;

    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    const first = sortedPlayers[0];
    const second = sortedPlayers[1];

    const eloDiff = first.elo - second.elo;

    // Only show if the top 2 are close in ELO
    if (eloDiff > 100) return null;

    // For aggregated players, we don't have IDs to find matches
    if (!('id' in first) || !('id' in second)) {
        return {
            type: 'top_duel',
            playerName: first.name,
            value: first.elo,
            description: `#1 vs #2`,
            emoji: '⚔️',
            opponent: second.name,
            secondaryValue: second.elo,
        };
    }

    // Find the last match between these two players
    const duelMatches = matches.filter(m => 
        (m.player1Id === first.id && m.player2Id === second.id) ||
        (m.player1Id === second.id && m.player2Id === first.id)
    ).sort((a, b) => b.timestamp - a.timestamp);

    let description = `#1 vs #2`;

    if (duelMatches.length > 0) {
        const lastMatch = duelMatches[0];
        const firstWasPlayer1 = lastMatch.player1Id === first.id;
        
        if (lastMatch.outcome === 'draw') {
            description = t('liveDisplay.lastDuel') + ': ' + t('match.draw');
        } else {
            const firstWon = (firstWasPlayer1 && lastMatch.outcome === 'p1') || 
                           (!firstWasPlayer1 && lastMatch.outcome === 'p2');
            const winner = firstWon ? first.name : second.name;
            
            // Calculate ELO delta for the winner
            let eloDelta = 0;
            if (firstWasPlayer1) {
                eloDelta = Math.abs(lastMatch.player1EloAfter - lastMatch.player1EloBefore);
            } else {
                eloDelta = Math.abs(lastMatch.player2EloAfter - lastMatch.player2EloBefore);
            }
            
            description = `${t('liveDisplay.lastDuel')}: ${winner} +${eloDelta}`;
        }
    }

    return {
        type: 'top_duel',
        playerName: first.name,
        value: first.elo,
        description,
        emoji: '⚔️',
        opponent: second.name,
        secondaryValue: second.elo,
    };
}

/**
 * Collect all available highlights for the current game state
 */
export function collectAllHighlights(
    players: (Player | AggregatedPlayer)[],
    matches: Match[]
): StoryHighlight[] {
    const highlights: StoryHighlight[] = [];

    // Always try to add champion first
    const champion = findCurrentChampion(players);
    if (champion) highlights.push(champion);

    // Add win streak if significant
    const winStreak = findBiggestWinStreak(players);
    if (winStreak) highlights.push(winStreak);

    // Add biggest ELO gain
    const eloGain = findBiggestEloGain(matches);
    if (eloGain) highlights.push(eloGain);

    // Add upset if any
    const upset = findBiggestUpset(matches);
    if (upset) highlights.push(upset);

    // Add most active player
    const mostActive = findMostActive(players);
    if (mostActive) highlights.push(mostActive);

    // Add top duel if close
    const topDuel = findTopDuel(players, matches);
    if (topDuel) highlights.push(topDuel);

    return highlights;
}
