import { Match, Player } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';

export function renderBattleHistory(
    matchHistory: Match[],
    DOMElements: AppDOMElements
) {
    if (!DOMElements.battleHistoryList) return;
    if (matchHistory.length === 0) {
        DOMElements.battleHistoryList.innerHTML = '<div class="battle-history-entry">No matches recorded yet.</div>';
        return;
    }
    const matches = [...matchHistory].sort((a, b) => b.timestamp - a.timestamp);
    DOMElements.battleHistoryList.innerHTML = '';
    matches.forEach(match => {
        const expectedScoreP1 = 1 / (1 + 10 ** ((match.player2EloBefore - match.player1EloBefore) / 400));
        const expectedScoreP2 = 1 - expectedScoreP1;
        const p1Prob = Math.round(expectedScoreP1 * 100);
        const p2Prob = 100 - p1Prob;
        let outcomeText = '';
        if (match.outcome === 'p1') outcomeText = `${match.player1Name} Won`;
        else if (match.outcome === 'p2') outcomeText = `${match.player2Name} Won`;
        else outcomeText = 'Draw';
        const date = new Date(match.timestamp);
        const timestampStr = date.toLocaleString();
        const entry = document.createElement('div');
        entry.className = 'battle-history-entry';
        entry.innerHTML = `
            <div class="battle-history-header">
                <span class="battle-history-players">
                    ${match.player1Name} <span style="color:#888;font-size:0.95em">(${match.player1EloBefore} ELO ${match.player1EloChange ? (match.player1EloChange > 0 ? '<span class="elo-up">+' : '<span class="elo-down">' ) + match.player1EloChange + '</span>' : ''})</span>
                    vs.
                    ${match.player2Name} <span style="color:#888;font-size:0.95em">(${match.player2EloBefore} ELO ${match.player2EloChange ? (match.player2EloChange > 0 ? '<span class="elo-up">+' : '<span class="elo-down">' ) + match.player2EloChange + '</span>' : ''})</span>
                </span>
                <span class="battle-history-timestamp">${timestampStr}</span>
            </div>
            <div class="battle-history-outcome">${outcomeText}</div>
            <div class="battle-history-winprob-bar">
                <span class="winprob-label">${match.player1Name}: ${p1Prob}%</span>
                <div class="winprob-bar">
                    <div class="winprob-bar-p1" style="width:${p1Prob}%;"></div>
                    <div class="winprob-bar-p2" style="width:${p2Prob}%;"></div>
                </div>
                <span class="winprob-label">${match.player2Name}: ${p2Prob}%</span>
            </div>
        `;
        DOMElements.battleHistoryList!.appendChild(entry);
    });
} 