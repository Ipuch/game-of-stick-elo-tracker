/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { store } from '../state/store';

/**
 * Show a toast notification
 */
export function showNotification(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('app-notification');
    if (!toast) return;

    // Reset classes and force reflow to restart animation if clicked rapidly
    toast.className = 'notification-toast';
    void toast.offsetWidth;

    toast.textContent = message;
    toast.classList.add('show', type);

    // Also update the persistent status bar with the message
    updateStatusBarMessage(message, type);

    // Wait 1.5s then start vanishing
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hiding');

        // After hiding animation (1s), reset fully
        setTimeout(() => {
            toast.classList.remove('hiding', 'success', 'error');
        }, 1000);
    }, 1500);
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
            statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> has unsaved changes.`;
        } else {
            statusBar.classList.remove('saved', 'error');
            // Neutral state
            statusText.innerHTML = `📂 Current Game: <strong>${store.folderName}</strong>`;
        }
    } else if (store.folderName) {
        // Memory only
        statusBar.style.display = 'block';
        statusBar.classList.remove('saved');
        statusText.innerHTML = `⚠ <strong>${store.folderName}</strong> (Not saved to folder)`;
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
