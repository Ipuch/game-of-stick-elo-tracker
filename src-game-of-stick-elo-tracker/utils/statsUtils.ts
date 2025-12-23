/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';

export function calculatePlayerStreaks(players: Player[], matchHistory: Match[]) {
    players.forEach(player => {
        let streakType: 'W' | 'L' | null = null;
        let streakLength = 0;

        // Filter matches involving the current player, and sort by timestamp descending
        const playerMatches = matchHistory
            .filter(m => m.player1Id === player.id || m.player2Id === player.id)
            .sort((a, b) => b.timestamp - a.timestamp);

        for (const match of playerMatches) {
            const isPlayer1 = match.player1Id === player.id;
            let outcomeForPlayer: 'W' | 'L' | 'D' | null = null;

            if (isPlayer1) {
                if (match.outcome === 'p1') outcomeForPlayer = 'W';
                else if (match.outcome === 'p2') outcomeForPlayer = 'L';
                else outcomeForPlayer = 'D';
            } else { // Player 2
                if (match.outcome === 'p2') outcomeForPlayer = 'W';
                else if (match.outcome === 'p1') outcomeForPlayer = 'L';
                else outcomeForPlayer = 'D';
            }

            if (outcomeForPlayer === 'D') {
                // Draws break current streak, but don't count as win/loss for a new streak
                break;
            }

            if (!streakType) {
                // First win or loss establishes the streak type
                streakType = outcomeForPlayer;
                streakLength = 1;
            } else if (streakType === outcomeForPlayer) {
                // Continue the streak
                streakLength++;
            } else {
                // Streak broken (changed from W to L, or L to W)
                break;
            }
        }
        player.currentStreakType = streakType;
        player.currentStreakLength = streakLength;
    });
}
