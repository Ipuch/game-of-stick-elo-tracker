/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Player } from '../types/appTypes';
import { eloScoring, DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';
import { AppDOMElements } from '../utils/domElements';
import { store } from '../state/store';
import { showNotification } from '../ui/notificationSystem';
import { findPlayerByName, createGlobalPlayer, addAliasToPlayer } from '../utils/registryUtils';
import { saveRegistry } from '../utils/registryPersistence';
import { AppContext } from '../types/contextTypes';
import { handleError } from '../utils/errorHandler';

export async function handleAddPlayer(event: SubmitEvent, context: AppContext) {
    event.preventDefault();
    const { DOMElements } = context;
    
    try {
        const nameInput = DOMElements.newPlayerNameInput;
        const birthdateInput = DOMElements.newPlayerBirthdateInput;
        const name = nameInput?.value.trim();
        const birthDate = birthdateInput?.value || undefined; // ISO date string or undefined

        if (DOMElements.addPlayerError) DOMElements.addPlayerError.textContent = '';

        if (!name) {
            handleError(new Error('Player name cannot be empty'), {
                context: 'AddPlayer',
                userMessage: 'Player name cannot be empty',
                severity: 'warning'
            });
            return;
        }

        // Check if already in current session
        if (store.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            handleError(new Error(`Player "${name}" already exists in this session!`), {
                context: 'AddPlayer',
                userMessage: `Player "${name}" already exists in this session!`,
                severity: 'warning'
            });
            return;
        }

        // --- Registry Integration ---
        let globalPlayer = findPlayerByName(store.registry, name);
        let isNewGlobalPlayer = false;

        if (!globalPlayer) {
            // Create new global player with birthdate
            globalPlayer = createGlobalPlayer(name, birthDate);
            store.registry.push(globalPlayer);
            isNewGlobalPlayer = true;
        } else {
            // Add this spelling as alias if different
            addAliasToPlayer(globalPlayer, name);
            // Update birthdate if provided and player didn't have one
            if (birthDate && !globalPlayer.birthDate) {
                globalPlayer.birthDate = birthDate;
            }
        }

        // Save registry if we have a library handle
        if (store.libraryHandle && (isNewGlobalPlayer || store.registryLoaded)) {
            try {
                await saveRegistry(store.libraryHandle, store.registry);
            } catch (e) {
                handleError(e, {
                    context: 'AddPlayer:SaveRegistry',
                    severity: 'warning'
                });
                // Non-fatal - continue with session
            }
        }

        // Create session player linked to global ID
        const newPlayer: Player = {
            id: globalPlayer.id, // Use global ID instead of random UUID
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

        const msg = isNewGlobalPlayer
            ? `Player "${name}" added (new in registry)`
            : `Player "${name}" added (from registry)`;
        showNotification(msg, 'success');

        // Clear form inputs
        if (nameInput) nameInput.value = '';
        if (birthdateInput) birthdateInput.value = '';
    } catch (error) {
        handleError(error, {
            context: 'AddPlayer',
            userMessage: 'Failed to add player'
        });
    }
}

export function handleClearPlayers(context: AppContext) {
    if (confirm('Are you sure you want to clear ALL players and match history? This action cannot be undone.')) {
        try {
            store.players = [];
            store.matchHistory = [];
            store.kFactor = DEFAULT_ELO_CONFIG.parameters.kFactor;
            if (context.DOMElements.kFactorInput) {
                context.DOMElements.kFactorInput.value = store.kFactor.toString();
            }
            context.updateKFactorInputState();
            context.persist(); // Save cleared state
            context.render();
            showNotification('All players and match history cleared.', 'success');
        } catch (error) {
            handleError(error, {
                context: 'ClearPlayers',
                userMessage: 'Failed to clear players'
            });
        }
    }
}
