/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { store } from '../state/store';
import { saveGameToSession, selectLibraryFolder, createGameInLibrary, deleteTempBackup } from '../utils/fileSystemPersistence';
import { saveLastLibraryName, clearTemporaryData } from '../utils/localStoragePersistence';
import { showNotification } from '../ui/notificationSystem';
import { broadcastGameUpdate } from '../services/syncService';
import { SessionContext } from '../types/contextTypes';
import { handleError } from '../utils/errorHandler';

export async function handleSaveGame(context: SessionContext) {
    console.log('handleSaveGame called');

    // Case 1: Already a valid file system game
    if (store.directoryHandle) {
        try {
            await saveGameToSession(store.directoryHandle, {
                players: store.players,
                matchHistory: store.matchHistory,
                kFactor: store.kFactor
            });

            // CLEANUP BACKUP on successful save
            if (store.libraryHandle && store.folderName) {
                await deleteTempBackup(store.libraryHandle, store.folderName);
            }

            store.hasUnsavedChanges = false;
            context.updateSaveButton();
            broadcastGameUpdate();
            showNotification('Game saved successfully', 'success');
        } catch (e) {
            handleError(e, {
                context: 'SaveGame',
                userMessage: 'Failed to save game'
            });
        }
        return;
    }

    // Case 2: Legacy/Memory Session -> Export to Library
    if (!confirm('This will save the current game to a folder. Continue?')) {
        return;
    }

    try {
        const libraryHandle = await selectLibraryFolder();
        if (!libraryHandle) return;

        const defaultName = store.folderName || `Game_${new Date().toISOString().split('T')[0]}`;
        const gameName = prompt('Enter a name for the new game folder:', defaultName);
        if (!gameName) return;

        const newGameDir = await createGameInLibrary(libraryHandle, gameName);

        await saveGameToSession(newGameDir, {
            players: store.players,
            matchHistory: store.matchHistory,
            kFactor: store.kFactor
        });

        store.libraryHandle = libraryHandle;
        store.directoryHandle = newGameDir;
        store.folderName = gameName;
        store.currentSessionId = null;
        store.hasUnsavedChanges = false;

        saveLastLibraryName(libraryHandle.name);
        clearTemporaryData();

        context.updateSaveButton();
        context.render();

        showNotification(`Successfully saved to ${gameName}`, 'success');

    } catch (e: any) {
        const msg = e.message || 'Unknown error occurred';
        handleError(e, {
            context: 'SaveGame',
            userMessage: `Failed to save: ${msg}`
        });
    }
}

export function handleExit(context: SessionContext) {
    if (store.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to exit without saving?')) {
            return;
        }
        // If they confirm exit without saving, we should cleanup the backup too
        if (store.libraryHandle && store.folderName) {
            deleteTempBackup(store.libraryHandle, store.folderName).catch(error => {
                handleError(error, {
                    context: 'Exit:CleanupBackup',
                    severity: 'warning'
                });
            });
        }
    }

    // Clear game state but keep library handle
    store.directoryHandle = null;
    store.folderName = null;
    store.currentSessionId = null;
    store.players = [];
    store.matchHistory = [];
    store.hasUnsavedChanges = false;

    // Switch back to menu
    document.getElementById('app-main')!.style.display = 'none';
    context.renderGameMenu();
}

/**
 * Explicitly bind Save and Exit button listeners.
 */
export function bindSaveExitListeners(
    saveHandler: () => void,
    exitHandler: () => void
) {
    const saveBtn = document.getElementById('nav-save-btn') as HTMLButtonElement | null;
    const exitBtn = document.getElementById('nav-exit-btn') as HTMLButtonElement | null;

    if (saveBtn) {
        console.log('bindSaveExitListeners: Setting Save onclick handler');
        saveBtn.onclick = saveHandler;
    } else {
        handleError('bindSaveExitListeners: Save button NOT FOUND!', {
            context: 'BindListeners',
            severity: 'error'
        });
    }

    if (exitBtn) {
        console.log('bindSaveExitListeners: Setting Exit onclick handler');
        exitBtn.onclick = exitHandler;
    } else {
        handleError('bindSaveExitListeners: Exit button NOT FOUND!', {
            context: 'BindListeners',
            severity: 'error'
        });
    }
}
