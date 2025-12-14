/**
 * Opponent tracking utilities for the remaining opponents feature
 */

import { Player, Match } from '../types/appTypes';

export interface OpponentStats {
    playerId: string;
    playerName: string;
    timesFought: number;
}

export interface RemainingOpponentsResult {
    round: number;
    opponents: OpponentStats[];
    allFought: boolean;
}

/**
 * Get the count of matches between two players
 */
function getMatchCount(
    playerId: string,
    opponentId: string,
    matchHistory: Match[]
): number {
    return matchHistory.filter(m =>
        (m.player1Id === playerId && m.player2Id === opponentId) ||
        (m.player1Id === opponentId && m.player2Id === playerId)
    ).length;
}

/**
 * Calculate remaining opponents for a player
 * Returns the current round and list of opponents with fight counts
 */
export function getRemainingOpponents(
    playerId: string,
    allPlayers: Player[],
    matchHistory: Match[]
): RemainingOpponentsResult {
    // Get all opponents (everyone except the player)
    const opponents = allPlayers.filter(p => p.id !== playerId);

    if (opponents.length === 0) {
        return { round: 1, opponents: [], allFought: true };
    }

    // Calculate match counts for each opponent
    const opponentStats: OpponentStats[] = opponents.map(opp => ({
        playerId: opp.id,
        playerName: opp.name,
        timesFought: getMatchCount(playerId, opp.id, matchHistory)
    }));

    // Sort by times fought (ascending) - least fought first
    opponentStats.sort((a, b) => a.timesFought - b.timesFought);

    // Determine current round based on minimum matches
    const minFights = opponentStats.length > 0 ? opponentStats[0].timesFought : 0;
    const currentRound = minFights + 1;

    // Remaining = those with fewer fights than the current round target
    const remaining = opponentStats.filter(o => o.timesFought < currentRound);

    return {
        round: currentRound,
        opponents: remaining,
        allFought: remaining.length === 0
    };
}
