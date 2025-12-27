/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Match } from '../types/appTypes';
import { generateUUID } from '../utils/uuid';
import { eloScoring } from '../scoring';
import { calculatePlayerStreaks } from '../utils/statsUtils';
import { AppDOMElements } from '../utils/domElements';
import { store } from '../state/store';
import { showNotification } from '../ui/notificationSystem';
import { hideSuggestions } from '../ui/autocomplete';
import { renderRemainingOpponents } from '../renderers/opponentsRenderer';

export type MatchHandlerContext = {
    render: () => void;
    persist: () => void;
    updateKFactorInputState: () => void;
    DOMElements: AppDOMElements;
};

export function updateWinnerLabels(DOMElements: AppDOMElements) {
    const { player1Input, player2Input, winnerP1Label, winnerP2Label } = DOMElements;
    if (!player1Input || !player2Input || !winnerP1Label || !winnerP2Label) return;

    const p1Name = player1Input.value.trim() || 'Player 1';
    const p2Name = player2Input.value.trim() || 'Player 2';

    winnerP1Label.textContent = `${p1Name} Wins`;
    winnerP2Label.textContent = `${p2Name} Wins`;

    // Update remaining opponents display
    renderRemainingOpponents(store.players, store.matchHistory, DOMElements);
}

export function handleRecordMatch(event: SubmitEvent, context: MatchHandlerContext) {
    event.preventDefault();
    const { DOMElements } = context;
    const form = event.target as HTMLFormElement;

    const p1Id = DOMElements.player1IdInput?.value;
    const p2Id = DOMElements.player2IdInput?.value;

    const formData = new FormData(form);
    const winner = formData.get('winner') as 'p1' | 'p2' | 'draw' | null;

    if (DOMElements.matchError) DOMElements.matchError.textContent = '';

    if (!p1Id || !p2Id) {
        if (DOMElements.matchError) DOMElements.matchError.textContent = 'Please select both players from the list.';
        return;
    }

    if (p1Id === p2Id) {
        if (DOMElements.matchError) DOMElements.matchError.textContent = 'Players cannot be the same.';
        return;
    }

    if (!winner) {
        if (DOMElements.matchError) DOMElements.matchError.textContent = 'Please select the outcome.';
        return;
    }

    const player1 = store.players.find(p => p.id === p1Id);
    const player2 = store.players.find(p => p.id === p2Id);

    if (!player1 || !player2) {
        if (DOMElements.matchError) DOMElements.matchError.textContent = 'One or more players not found.';
        return;
    }

    const result = eloScoring.calculateNewRatings(player1.elo, player2.elo, winner, store.kFactor);
    const newP1Elo = result.newP1Rating;
    const newP2Elo = result.newP2Rating;

    const newMatch: Match = {
        id: generateUUID(),
        timestamp: Date.now(),
        player1Id: player1.id,
        player2Id: player2.id,
        player1Name: player1.name,
        player2Name: player2.name,
        player1EloBefore: player1.elo,
        player2EloBefore: player2.elo,
        player1EloAfter: newP1Elo,
        player2EloAfter: newP2Elo,
        outcome: winner,
        player1EloChange: newP1Elo - player1.elo,
        player2EloChange: newP2Elo - player2.elo,
    };
    store.matchHistory.push(newMatch);

    const oldP1Elo = player1.elo;
    const oldP2Elo = player2.elo;

    player1.elo = newP1Elo;
    player2.elo = newP2Elo;

    player1.lastEloChange = newP1Elo - oldP1Elo;
    player2.lastEloChange = newP2Elo - oldP2Elo;

    if (winner === 'p1') {
        player1.wins++;
        player2.losses++;
    } else if (winner === 'p2') {
        player1.losses++;
        player2.wins++;
    } else { // Draw
        player1.draws++;
        player2.draws++;
    }

    // After updating stats, recalculate streaks
    calculatePlayerStreaks(store.players, store.matchHistory);

    context.updateKFactorInputState();
    context.persist();

    // Prepare Notification Message
    let msg = '';
    if (winner === 'p1') {
        msg = `${player1.name} won against ${player2.name}`;
    } else if (winner === 'p2') {
        msg = `${player2.name} won against ${player1.name}`;
    } else {
        msg = `Draw between ${player1.name} and ${player2.name}`;
    }
    showNotification(msg, 'success');

    // Reset Form
    form.reset();

    // Explicitly clear specific elements
    if (DOMElements.player1Input) DOMElements.player1Input.value = '';
    if (DOMElements.player2Input) DOMElements.player2Input.value = '';
    if (DOMElements.player1IdInput) DOMElements.player1IdInput.value = '';
    if (DOMElements.player2IdInput) DOMElements.player2IdInput.value = '';

    updateWinnerLabels(DOMElements);
    hideSuggestions(DOMElements.player1Suggestions);
    hideSuggestions(DOMElements.player2Suggestions);

    // Ensure UI updates to reflect new match/rankings
    context.render();
}

export function handleClearMatchHistory(context: MatchHandlerContext) {
    if (confirm('Are you sure you want to clear all match history? This action cannot be undone.')) {
        store.matchHistory = [];
        // Reset all player stats and ELOs to initial state
        store.players.forEach(player => {
            player.elo = eloScoring.getInitialRating();
            player.wins = 0;
            player.losses = 0;
            player.draws = 0;
            player.previousRank = 0;
            player.currentStreakType = null;
            player.currentStreakLength = 0;
            player.lastEloChange = 0;
        });
        context.updateKFactorInputState();
        context.persist(); // Save connection state
        context.render();
        alert('Match history cleared and player stats reset.');
    }
}
