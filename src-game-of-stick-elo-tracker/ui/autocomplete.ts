/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Player } from '../types/appTypes';
import { store } from '../state/store';
import { AppDOMElements } from '../utils/domElements';

type AutocompleteCallbacks = {
    updateWinnerLabels: () => void;
};

export function hideSuggestions(container: HTMLElement | null) {
    if (container) {
        container.innerHTML = '';
    }
}

function showSuggestions(
    filteredPlayers: Player[],
    suggestionsContainer: HTMLElement,
    textInput: HTMLInputElement,
    idInput: HTMLInputElement,
    callbacks: AutocompleteCallbacks
) {
    hideSuggestions(suggestionsContainer);
    if (filteredPlayers.length === 0) {
        suggestionsContainer.innerHTML = `<div class="suggestion-item-none">No matching players</div>`;
        return;
    }

    filteredPlayers.forEach(player => {
        const item = document.createElement('div');
        item.classList.add('suggestion-item');
        item.dataset.id = player.id; // Store ID
        item.dataset.name = player.name; // Store Name
        item.innerHTML = `<span>${player.name}</span> <small>${player.elo} ELO</small>`;

        item.addEventListener('pointerdown', (e) => { // pointerdown covers mouse and touch, fires before click/blur
            e.preventDefault();
            console.log('Suggestion ID selected:', player.id, player.name);
            textInput.value = player.name;
            idInput.value = player.id;
            hideSuggestions(suggestionsContainer);
            callbacks.updateWinnerLabels();
        });

        suggestionsContainer.appendChild(item);
    });
}

export function handleAutocompleteInput(
    event: Event,
    DOMElements: AppDOMElements,
    callbacks: AutocompleteCallbacks
) {
    const input = event.target as HTMLInputElement;
    let suggestionsContainer: HTMLElement | null, idInput: HTMLInputElement | null, otherPlayerId: string | undefined;

    if (input.id === 'player1-input') {
        suggestionsContainer = DOMElements.player1Suggestions;
        idInput = DOMElements.player1IdInput;
        otherPlayerId = DOMElements.player2IdInput?.value;
    } else {
        suggestionsContainer = DOMElements.player2Suggestions;
        idInput = DOMElements.player2IdInput;
        otherPlayerId = DOMElements.player1IdInput?.value;
    }

    if (!suggestionsContainer || !idInput) return;

    idInput.value = ''; // Clear old selection when user types
    const filterText = input.value.toLowerCase().trim();

    callbacks.updateWinnerLabels();

    if (filterText.length === 0) {
        hideSuggestions(suggestionsContainer);
        return;
    }

    const filteredPlayers = store.players.filter(p =>
        p.name.toLowerCase().includes(filterText) && p.id !== otherPlayerId
    );

    showSuggestions(filteredPlayers, suggestionsContainer, input, idInput, callbacks);
}

export function handleKeydown(
    event: KeyboardEvent,
    playerType: 'p1' | 'p2',
    DOMElements: AppDOMElements,
    callbacks: AutocompleteCallbacks
) {
    if (event.key === 'Tab') {
        const input = event.target as HTMLInputElement;
        let suggestionsContainer: HTMLElement | null, idInput: HTMLInputElement | null;

        if (playerType === 'p1') {
            suggestionsContainer = DOMElements.player1Suggestions;
            idInput = DOMElements.player1IdInput;
        } else {
            suggestionsContainer = DOMElements.player2Suggestions;
            idInput = DOMElements.player2IdInput;
        }

        if (suggestionsContainer && suggestionsContainer.children.length > 0) {
            const firstItem = suggestionsContainer.firstElementChild as HTMLElement;
            if (firstItem && !firstItem.classList.contains('suggestion-item-none')) {
                const name = firstItem.dataset.name;
                const id = firstItem.dataset.id;

                if (name && id && idInput) {
                    input.value = name;
                    idInput.value = id;
                    hideSuggestions(suggestionsContainer);
                    callbacks.updateWinnerLabels();
                }
            }
        }
    }
}
