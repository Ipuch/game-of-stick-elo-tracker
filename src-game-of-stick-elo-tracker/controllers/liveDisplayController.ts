/**
 * Game of STICK - ELO Tracker
 * Live Display Controller
 * Manages the live event display functionality
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { store } from '../state/store';
import { renderLiveDisplay, stopLiveDisplay, isLiveDisplayActive } from '../renderers/liveEventDisplay';
import { renderLeaderboard } from '../renderers/leaderboard';
import { renderPodium } from '../renderers/podium';
import { AppDOMElements } from '../utils/domElements';

export interface LiveDisplayCallbacks {
    updateLeaderboardBaseline: () => void;
    getDOMElements: () => AppDOMElements;
}

let callbacks: LiveDisplayCallbacks | null = null;

/**
 * Initialize the live display controller with callbacks
 */
export function initLiveDisplayController(cbs: LiveDisplayCallbacks): void {
    callbacks = cbs;
}

/**
 * Launch the live event display view
 */
export function handleLaunchLiveDisplay(): void {
    const liveContainer = document.getElementById('live-display-view');
    if (!liveContainer) return;

    const gameName = store.folderName || 'Game of Stick';
    
    // Hide main app, show live display
    document.getElementById('app-main')!.style.display = 'none';
    liveContainer.style.display = 'block';
    
    // Render live display - pass both ELO and rank snapshots for frozen display
    renderLiveDisplay(
        liveContainer,
        store.players,
        store.matchHistory,
        gameName,
        store.previousLeaderboardElo,
        store.lastLeaderboardElo,
        store.previousLeaderboardRanks,
        store.lastLeaderboardRanks
    );

    // Bind event listeners
    bindLiveDisplayEventListeners(liveContainer);
}

/**
 * Handle update leaderboard button click in live display
 */
export function handleLiveUpdateLeaderboard(): void {
    if (!callbacks) {
        console.error('LiveDisplayController not initialized');
        return;
    }

    // FIRST update baseline (shift: previous=last, last=current)
    callbacks.updateLeaderboardBaseline();
    
    const DOMElements = callbacks.getDOMElements();
    
    // THEN render - diffs shown = lastSnapshot - previousSnapshot (frozen)
    renderLeaderboard(
        store.players, DOMElements, store.matchHistory,
        store.previousLeaderboardElo, store.lastLeaderboardElo,
        store.previousLeaderboardRanks, store.lastLeaderboardRanks
    );
    
    // Also update podium to stay in sync with leaderboard
    renderPodium(store.players, DOMElements);
    
    // Refresh the live display
    refreshLiveDisplayIfVisible();
}

/**
 * Exit the live display and return to main app
 */
export function handleExitLiveDisplay(): void {
    const liveContainer = document.getElementById('live-display-view');
    if (!liveContainer) return;

    // Stop animations
    stopLiveDisplay();
    
    // Hide live display, show main app
    liveContainer.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'block';
}

/**
 * Refresh live display if it's currently visible.
 * Re-renders and re-binds event listeners.
 */
export function refreshLiveDisplayIfVisible(): void {
    const liveContainer = document.getElementById('live-display-view');
    if (!liveContainer || liveContainer.style.display === 'none') return;

    const gameName = store.folderName || 'Game of Stick';
    renderLiveDisplay(
        liveContainer,
        store.players,
        store.matchHistory,
        gameName,
        store.previousLeaderboardElo,
        store.lastLeaderboardElo,
        store.previousLeaderboardRanks,
        store.lastLeaderboardRanks
    );

    // Re-bind buttons after re-render
    bindLiveDisplayEventListeners(liveContainer);
}

/**
 * Bind event listeners within the live display container
 */
function bindLiveDisplayEventListeners(container: HTMLElement): void {
    const exitBtn = container.querySelector('#live-exit-btn');
    if (exitBtn) {
        // Remove existing listener to avoid duplicates
        exitBtn.replaceWith(exitBtn.cloneNode(true));
        container.querySelector('#live-exit-btn')?.addEventListener('click', handleExitLiveDisplay);
    }
    
    const updateBtn = container.querySelector('#live-update-btn');
    if (updateBtn) {
        // Remove existing listener to avoid duplicates
        updateBtn.replaceWith(updateBtn.cloneNode(true));
        container.querySelector('#live-update-btn')?.addEventListener('click', handleLiveUpdateLeaderboard);
    }
}

/**
 * Setup keyboard listener for Escape key to exit live display
 */
export function setupLiveDisplayKeyboardListener(): void {
    if (!document.body.hasAttribute('data-live-key-listener')) {
        document.body.setAttribute('data-live-key-listener', 'true');
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isLiveDisplayActive()) {
                handleExitLiveDisplay();
            }
        });
    }
}

// Re-export for convenience
export { isLiveDisplayActive };
