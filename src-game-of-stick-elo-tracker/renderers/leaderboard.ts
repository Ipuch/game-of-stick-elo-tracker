import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';
import { calculatePlayerStreaks } from '../utils/playerUtils';



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
    lastLeaderboardElo: Record<string, number>
) {
    const tbody = document.getElementById('leaderboard-body');
    console.log('renderLeaderboard executing', { players, tbody });
    if (!tbody) {
        console.error('Leaderboard body NOT found');
        return;
    }

    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);



    tbody.innerHTML = '';

    if (players.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><a href="#" id="empty-leaderboard-link" style="color:var(--primary-color); text-decoration:underline;">No players yet. Add one here!</a></td></tr>`;
        return;
    }

    let rowsHtml = '';
    sortedPlayers.forEach((player, index) => {
        const newRank = index + 1;
        const oldRank = player.previousRank;

        let rankChangeIndicator = '';
        if (oldRank) {
            const diff = oldRank - newRank;
            if (diff > 0) {
                rankChangeIndicator = `<span class="rank-change rank-up">▲ ${diff}</span>`;
            } else if (diff < 0) {
                rankChangeIndicator = `<span class="rank-change rank-down">▼ ${Math.abs(diff)}</span>`;
            } else {
                rankChangeIndicator = `<span class="rank-change rank-no-change">=</span>`;
            }
        }

        // Calculate ELO diff since last leaderboard update
        const prevElo = lastLeaderboardElo[player.id] ?? player.elo;
        const eloDiff = player.elo - prevElo;
        const eloDiffHtml = eloDiff !== 0
            ? `<span class="elo-change ${eloDiff > 0 ? 'elo-up' : 'elo-down'}">(${eloDiff > 0 ? '+' : ''}${eloDiff})</span>`
            : '';

        rowsHtml += `
            <tr>
                <td><div>${newRank} ${rankChangeIndicator}</div></td>
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

    players.forEach(p => {
        const sortedIndex = sortedPlayers.findIndex(sp => sp.id === p.id);
        if (sortedIndex !== -1) {
            p.previousRank = sortedIndex + 1;
        }
    });

    calculatePlayerStreaks(players, matchHistory);
} 