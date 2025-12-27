/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Player } from '../types/appTypes';
import { generateUUID } from '../utils/uuid';
import { eloScoring, DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';
import { AppDOMElements } from '../utils/domElements';
import { store } from '../state/store';
import { showNotification } from '../ui/notificationSystem';

export type PlayerHandlerContext = {
    render: () => void;
    persist: () => void;
    updateKFactorInputState: () => void;
    DOMElements: AppDOMElements;
};

export function handleAddPlayer(event: SubmitEvent, context: PlayerHandlerContext) {
    event.preventDefault();
    const { DOMElements } = context;
    const nameInput = DOMElements.newPlayerNameInput;
    const name = nameInput?.value.trim();

    if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = '';

    if (!name) {
        showNotification('Player name cannot be empty', 'error');
        return;
    }

    if (store.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`Player "${name}" already exists!`, 'error');
    } else {
        const newPlayer: Player = {
            id: generateUUID(),
            name: name,
            elo: eloScoring.getInitialRating(),
            wins: 0,
            losses: 0,
            draws: 0,
            previousRank: 0,
            currentStreakType: null,
            currentStreakLength: 0,
        };
        store.players.push(newPlayer);

        // Persist state and update UI immediately
        context.persist();
        context.render();

        showNotification(`Player "${name}" added!`, 'success');

        if (nameInput) nameInput.value = '';
    }
}

export function handleClearPlayers(context: PlayerHandlerContext) {
    if (confirm('Are you sure you want to clear ALL players and match history? This action cannot be undone.')) {
        store.players = [];
        store.matchHistory = [];
        store.kFactor = DEFAULT_ELO_CONFIG.parameters.kFactor;
        if (context.DOMElements.kFactorInput) {
            context.DOMElements.kFactorInput.value = store.kFactor.toString();
        }
        context.updateKFactorInputState();
        context.updateKFactorInputState();
        context.persist(); // Save cleared state
        context.render();
        alert('All players and match history cleared.');
    }
}
