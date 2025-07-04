import { Player } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';

function calculateWinLossRatio(player: Player): string {
    const totalGames = player.wins + player.losses;
    if (totalGames === 0) {
        return '0 W/L';
    }
    const ratio = (player.wins / totalGames) * 100;
    return `${ratio.toFixed(1)}% W/L`;
}

export function renderPodium(
    players: Player[],
    DOMElements: AppDOMElements
) {
    if (!DOMElements.podiumContainer) return;

    const topThree = [...players].sort((a, b) => b.elo - a.elo).slice(0, 3);
    
    DOMElements.podiumContainer.innerHTML = '';
    DOMElements.podiumContainer.style.display = topThree.length > 0 ? 'flex' : 'none';
    if (topThree.length === 0) return; // Hide podium if no players

    const podiumSpots = [
        { rank: 2, className: 'second', icon: '🥈' },
        { rank: 1, className: 'first', icon: '👑' },
        { rank: 3, className: 'third', icon: '🥉' },
    ];

    const visiblePodiumSpots = podiumSpots.filter(spot => spot.rank <= topThree.length);

    const rankedPlayers: { [key: number]: Player } = {};
    topThree.forEach((player, index) => {
        rankedPlayers[index + 1] = player;
    });

    visiblePodiumSpots.forEach(spotConfig => {
        const player = rankedPlayers[spotConfig.rank];
        if (player) {
            const spot = document.createElement('div');
            spot.classList.add('podium-spot', spotConfig.className);

            const keyStat = calculateWinLossRatio(player);

            spot.innerHTML = `
                <div class="podium-icon-container"><span class="podium-icon">${spotConfig.icon}</span></div>
                <div class="podium-name">${player.name}</div>
                <div class="podium-elo">${player.elo} ELO</div>
                <div class="podium-key-stat">${keyStat}</div>
            `;
            DOMElements.podiumContainer!.appendChild(spot);
        }
    });
} 