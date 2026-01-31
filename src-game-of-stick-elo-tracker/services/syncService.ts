/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { store } from '../state/store';
import { loadGameFromSession } from '../utils/fileSystemPersistence';
import { calculatePlayerStreaks } from '../utils/statsUtils';
import { showNotification } from '../ui/notificationSystem';

// --- BROADCAST CHANNEL FOR CROSS-WINDOW SYNC ---
const gameChannel = new BroadcastChannel('game-of-stick-sync');

export type SyncCallbacks = {
    onSyncStart: () => void;
    onSyncComplete: () => void;
    updateKFactorInputState: () => void;
    updateSaveButton: () => void;
    renderAll: () => void;
};

/**
 * Setup listener for updates from other windows
 */
export function setupSyncListener(callbacks: SyncCallbacks) {
    gameChannel.onmessage = async (event) => {
        const { type, folderName } = event.data;

        // Only sync if we're viewing the same game
        if (type === 'game-updated' && store.folderName === folderName && store.directoryHandle) {
            console.log('Received sync message from another window, reloading...');
            try {
                callbacks.onSyncStart();

                // Save current previousRank values to show position changes
                const oldRanks: Record<string, number> = {};
                store.players.forEach(p => {
                    oldRanks[p.id] = p.previousRank;
                });

                // Load new state from files
                const state = await loadGameFromSession(store.directoryHandle);

                // Merge: keep old previousRank for existing players to show deltas
                state.players.forEach(p => {
                    if (oldRanks[p.id] !== undefined) {
                        p.previousRank = oldRanks[p.id];
                    }
                });

                store.players = state.players;
                store.matchHistory = state.matchHistory;
                store.kFactor = state.kFactor;
                store.hasUnsavedChanges = false;

                // Recalculate streaks based on new match history
                calculatePlayerStreaks(store.players, store.matchHistory);

                callbacks.updateKFactorInputState();
                callbacks.updateSaveButton();
                callbacks.renderAll();

                showNotification('Game synced from another window');
                callbacks.onSyncComplete();
            } catch (e) {
                console.error('Failed to sync from other window:', e);
            }
        }
    };
}

/**
 * Notify other windows when game is saved
 */
export function broadcastGameUpdate() {
    if (store.folderName) {
        gameChannel.postMessage({
            type: 'game-updated',
            folderName: store.folderName
        });
    }
}
