/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';
import { getRemainingOpponents } from '../utils/opponentTracker';

/**
 * Render the opponent list for a single player
 */
function renderOpponentList(
    playerId: string,
    container: HTMLElement,
    otherId: string | undefined,
    players: Player[],
    matchHistory: Match[]
) {
    const result = getRemainingOpponents(playerId, players, matchHistory);

    if (result.allFought) {
        container.innerHTML = '<div class="round-complete">✓ All fought this round!</div>';
        return;
    }

    container.innerHTML = result.opponents.map(opp => {
        const isOtherPlayer = opp.playerId === otherId;
        const countClass = opp.timesFought === 0 ? 'count never-fought' : 'count';
        return `
            <div class="opponent-item${isOtherPlayer ? ' selected-opponent' : ''}" data-id="${opp.playerId}">
                <span class="name">${opp.playerName}</span>
                <span class="${countClass}">${opp.timesFought}</span>
            </div>
        `;
    }).join('');
}

/**
 * Render the remaining opponents card for the selected players
 */
export function renderRemainingOpponents(
    storePlayers: Player[],
    storeMatchHistory: Match[],
    DOMElements: AppDOMElements
) {
    const card = document.getElementById('remaining-opponents-card');
    const p1Col = document.getElementById('p1-opponents-col');
    const p2Col = document.getElementById('p2-opponents-col');
    const p1Header = document.getElementById('p1-opponents-header');
    const p2Header = document.getElementById('p2-opponents-header');
    const p1List = document.getElementById('p1-opponents-list');
    const p2List = document.getElementById('p2-opponents-list');

    if (!card || !p1Col || !p2Col || !p1Header || !p2Header || !p1List || !p2List) return;

    const p1Id = DOMElements.player1IdInput?.value;
    const p2Id = DOMElements.player2IdInput?.value;

    // Hide card if no players selected
    if (!p1Id && !p2Id) {
        card.setAttribute('hidden', 'true');
        return;
    }

    card.removeAttribute('hidden');

    // Render Player 1 opponents
    if (p1Id) {
        const p1 = storePlayers.find(p => p.id === p1Id);
        p1Header.textContent = `${p1?.name || 'Player 1'} (Round ${getRemainingOpponents(p1Id, storePlayers, storeMatchHistory).round})`;
        renderOpponentList(p1Id, p1List, p2Id, storePlayers, storeMatchHistory);
        p1Col.style.display = 'block';
    } else {
        p1Col.style.display = 'none';
    }

    // Render Player 2 opponents
    if (p2Id) {
        const p2 = storePlayers.find(p => p.id === p2Id);
        p2Header.textContent = `${p2?.name || 'Player 2'} (Round ${getRemainingOpponents(p2Id, storePlayers, storeMatchHistory).round})`;
        renderOpponentList(p2Id, p2List, p1Id, storePlayers, storeMatchHistory);
        p2Col.style.display = 'block';
    } else {
        p2Col.style.display = 'none';
    }
}
