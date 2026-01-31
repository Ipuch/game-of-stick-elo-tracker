/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';
import { calculatePlayerStreaks } from '../utils/playerUtils';
import { DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';



function renderStreak(type: 'W' | 'L' | null, length: number): string {
    if (length < 3 || !type) return '';

    let emoji = '';
    if (type === 'W') {
        emoji = '🔥'.repeat(Math.floor(length / 3));
    } else {
        emoji = '🧊'.repeat(Math.floor(length / 3));
    }

    return `<span class="streak-indicator">${emoji} ${type}${length}</span>`;
}

export function renderLeaderboard(
    players: Player[],
    _DOMElements: AppDOMElements,
    matchHistory: Match[],
    previousEloSnapshot: Record<string, number>,
    currentEloSnapshot?: Record<string, number>,
    previousRankSnapshot?: Record<string, number>,
    currentRankSnapshot?: Record<string, number>
) {
    const tbody = document.getElementById('leaderboard-body');
    console.log('renderLeaderboard executing', { players, tbody });
    if (!tbody) {
        console.error('Leaderboard body NOT found');
        return;
    }

    // Calculate streaks BEFORE rendering so they appear in the HTML
    calculatePlayerStreaks(players, matchHistory);

    // Sort by SNAPSHOTTED rank if available (frozen display), otherwise by current ELO
    let sortedPlayers: Player[];
    if (currentRankSnapshot && Object.keys(currentRankSnapshot).length > 0) {
        // Sort by frozen rank from snapshot
        sortedPlayers = [...players].sort((a, b) => {
            const rankA = currentRankSnapshot[a.id] ?? 9999;
            const rankB = currentRankSnapshot[b.id] ?? 9999;
            return rankA - rankB;
        });
    } else {
        // Fallback: sort by current ELO
        sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    }



    tbody.innerHTML = '';

    if (players.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><a href="#" id="empty-leaderboard-link" style="color:var(--primary-color); text-decoration:underline;">No players yet. Add one here!</a></td></tr>`;
        return;
    }

    let rowsHtml = '';
    sortedPlayers.forEach((player, index) => {
        // Use FROZEN rank from snapshot, not current sort position
        const displayedRank = currentRankSnapshot?.[player.id] ?? (index + 1);
        const previousRank = previousRankSnapshot?.[player.id];

        let rankChangeIndicator = '';
        if (previousRank !== undefined) {
            const diff = previousRank - displayedRank;
            if (diff > 0) {
                rankChangeIndicator = `<span class="rank-change rank-up">▲ ${diff}</span>`;
            } else if (diff < 0) {
                rankChangeIndicator = `<span class="rank-change rank-down">▼ ${Math.abs(diff)}</span>`;
            } else {
                rankChangeIndicator = `<span class="rank-change rank-no-change">=</span>`;
            }
        }

        // Calculate ELO diff: frozen diff = currentSnapshot - previousSnapshot
        const currentElo = currentEloSnapshot ? (currentEloSnapshot[player.id] ?? player.elo) : player.elo;
        const prevElo = previousEloSnapshot[player.id] ?? DEFAULT_ELO_CONFIG.initialRating;
        const eloDiff = currentElo - prevElo;
        const eloDiffHtml = eloDiff !== 0
            ? `<span class="elo-change ${eloDiff > 0 ? 'elo-up' : 'elo-down'}">(${eloDiff > 0 ? '+' : ''}${eloDiff})</span>`
            : '';

        rowsHtml += `
            <tr>
                <td><div>${displayedRank} ${rankChangeIndicator}</div></td>
                <td>${player.name} ${renderStreak(player.currentStreakType, player.currentStreakLength)}</td>
                <td>
                    ${player.elo}
                    ${eloDiffHtml}
                </td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td>${player.draws}</td>
                <td>${player.wins + player.losses + player.draws}</td>
            </tr>
        `;
        player.previousElo = player.elo;
    });
    tbody.innerHTML = rowsHtml;

    // NOTE: previousRank is now updated by updateLeaderboardBaseline() in index.tsx
    // This ensures both main leaderboard and live display stay in sync
} 