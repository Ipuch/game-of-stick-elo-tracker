import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';
import { calculatePlayerStreaks } from '../utils/playerUtils';

function calculateWinLossRatio(player: Player): string {
    const totalGames = player.wins + player.losses;
    if (totalGames === 0) {
        return '0 W/L';
    }
    const ratio = (player.wins / totalGames) * 100;
    return `${ratio.toFixed(1)}% W/L`;
}

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
    DOMElements: AppDOMElements,
    matchHistory: Match[]
) {
    if (!DOMElements.leaderboardBody) return;
    
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    
    console.log('Rendering Leaderboard with players:', sortedPlayers);

    DOMElements.leaderboardBody.innerHTML = '';

    if (players.length === 0) {
        DOMElements.leaderboardBody.innerHTML = `<tr><td colspan="7">No players yet. Add one below!</td></tr>`;
        return;
    }

    sortedPlayers.forEach((player, index) => {
        // Reset lastEloChange if ELO did not change since last render
        if (typeof player.previousElo === 'number' && player.elo === player.previousElo) {
            player.lastEloChange = 0;
        }
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

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div>${newRank} ${rankChangeIndicator}</div></td>
            <td>${player.name} ${renderStreak(player.currentStreakType, player.currentStreakLength)}</td>
            <td>
                ${player.elo}
                ${player.lastEloChange !== undefined && player.lastEloChange !== 0 
                    ? `<span class="elo-change ${player.lastEloChange > 0 ? 'elo-up' : 'elo-down'}">(${player.lastEloChange > 0 ? '+' : ''}${player.lastEloChange})</span>` 
                    : ''}
            </td>
            <td>${player.wins}</td>
            <td>${player.losses}</td>
            <td>${player.draws}</td>
            <td>${player.wins + player.losses + player.draws}</td>
        `;
        // Remove click event logic for player name
        DOMElements.leaderboardBody!.appendChild(row);
        // Update previousElo for next render
        player.previousElo = player.elo;
    });
    
    players.forEach(p => {
        const sortedIndex = sortedPlayers.findIndex(sp => sp.id === p.id);
        if(sortedIndex !== -1) {
            p.previousRank = sortedIndex + 1;
        }
    });

    calculatePlayerStreaks(players, matchHistory);
} 