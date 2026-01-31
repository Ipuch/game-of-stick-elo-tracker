/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { store } from '../state/store';

/**
 * Show a toast notification
 */
import { t } from '../utils/i18n';

/**
 * Show a notification in the status bar (footer) only
 */
export function showNotification(message: string, type: 'success' | 'error' = 'success') {
    // Show message in footer
    updateStatusBarMessage(message, type);

    // Revert to default status (Current Game...) after 4 seconds
    setTimeout(() => {
        updateStatusBar();
    }, 4000);
}

/**
 * Update the persistent status bar at the bottom of the screen
 */
export function updateStatusBar() {
    const statusBar = document.getElementById('app-status-bar');
    const statusText = document.getElementById('status-bar-text');
    if (!statusBar || !statusText) return;

    if (store.directoryHandle && store.folderName) {
        // Show persistent game context
        statusBar.style.display = 'block';
        if (store.hasUnsavedChanges) {
            statusBar.classList.remove('saved');
            statusBar.classList.add('error'); // Use helpful color for attention
            statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> ${t('notifications.unsavedChanges')}`;
        } else {
            statusBar.classList.remove('saved', 'error');
            // Neutral state
            statusText.innerHTML = `📂 ${t('notifications.currentGame')}: <strong>${store.folderName}</strong>`;
        }
    } else if (store.folderName) {
        // Memory only
        statusBar.style.display = 'block';
        statusBar.classList.remove('saved');
        // Memory only
        statusBar.style.display = 'block';
        statusBar.classList.remove('saved');
        statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> (${t('notifications.notSaved')})`;
    } else {
        statusBar.style.display = 'none';
    }
}

/**
 * Update the status bar with a message (persistent log)
 */
export function updateStatusBarMessage(message: string, type: 'success' | 'error' = 'success') {
    const statusBar = document.getElementById('app-status-bar');
    const statusText = document.getElementById('status-bar-text');
    if (!statusBar || !statusText) return;

    statusBar.style.display = 'block';

    if (type === 'success') {
        statusBar.classList.add('saved');
        statusBar.classList.remove('error');
    } else {
        statusBar.classList.remove('saved');
        statusBar.classList.add('error');
    }

    statusText.innerHTML = message;
}
