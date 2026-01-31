/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { listGamesInLibrary, getGameQuickStats } from '../utils/fileSystemPersistence';
import { t } from '../utils/i18n';

export type LibraryCallbacks = {
    onLoadGame: (handle: FileSystemDirectoryHandle, name: string) => Promise<void>;
    onCreateGame: (name: string, kFactor: number) => Promise<void>;
    onViewAggregatedStats: () => void;
    onViewRegistry: () => void;
    onViewRules?: () => void;
};

export async function renderGameLibrary(
    libraryHandle: FileSystemDirectoryHandle,
    callbacks: LibraryCallbacks
) {
    // Fix Race Condition: Fetch ALL data (games + stats) BEFORE touching the DOM
    const games = await listGamesInLibrary(libraryHandle);

    // Fetch stats concurrently for all games
    const gameItems = await Promise.all(games.map(async (g) => {
        const stats = await getGameQuickStats(g.handle);
        return { handle: g.handle, name: g.name, stats };
    }));

    // Sort by last match date (most recent first)
    gameItems.sort((a, b) => {
        const dateA = a.stats.lastMatchDate || 0;
        const dateB = b.stats.lastMatchDate || 0;
        return dateB - dateA; // Descending (newest first)
    });

    // --- SYNCHRONOUS DOM UPDATE BLOCK ---
    const menuEl = document.getElementById('game-menu');
    const mainEl = document.getElementById('app-main');
    if (menuEl) menuEl.style.display = 'flex';
    if (mainEl) mainEl.style.display = 'none';

    // Clear all menu areas
    const list = document.getElementById('session-list')!;
    const headerArea = document.getElementById('library-header-compact');
    const statsArea = document.getElementById('aggregated-stats-area');

    list.innerHTML = '';
    if (headerArea) headerArea.innerHTML = '';
    if (statsArea) statsArea.innerHTML = '';

    // 1. Render Library Name
    if (headerArea) {
        headerArea.innerHTML = `<span class="library-label">${t('library.label')}:</span> <span class="library-name">${libraryHandle.name}</span>`;
    }

    // 2. Render Aggregated Stats Button & Registry Button
    if (statsArea) {
        if (gameItems.length > 0) {
            const aggBtn = document.createElement('button');
            aggBtn.className = 'button-secondary agg-stats-btn width-full';
            aggBtn.innerHTML = t('library.viewAggregatedStats');
            aggBtn.onclick = () => callbacks.onViewAggregatedStats();
            statsArea.appendChild(aggBtn);
        }

        // Registry Manager Button
        const regBtn = document.createElement('button');
        regBtn.className = 'button-secondary registry-nav-btn width-full';
        regBtn.innerHTML = t('library.manageRegistry');
        regBtn.onclick = () => callbacks.onViewRegistry();
        statsArea.appendChild(regBtn);

        // Rules Button
        if (callbacks.onViewRules) {
            const rulesBtn = document.createElement('button');
            rulesBtn.className = 'button-secondary rules-nav-btn width-full';
            rulesBtn.innerHTML = t('rules.menuButton');
            rulesBtn.onclick = () => callbacks.onViewRules!();
            statsArea.appendChild(rulesBtn);
        }
    }

    // 3. Render Game List
    if (gameItems.length === 0) {
        const msg = document.createElement('div');
        msg.innerHTML = `<div class="empty-list-msg">${t('library.empty')}</div>`;
        list.appendChild(msg);
    } else {
        gameItems.forEach(({ handle, name, stats }) => {
            const card = document.createElement('button'); // Use button for better semantics/a11y
            card.className = 'session-item session-item-detailed';

            const lastPlayed = stats.lastMatchDate
                ? new Date(stats.lastMatchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : t('library.new');

            card.innerHTML = `
                <div class="session-main-info">
                    <span class="session-name">${name}</span>
                    <span class="session-date-badge">${lastPlayed}</span>
                </div>
                <div class="session-details">
                    <span title="Players">👥 ${stats.playerCount}</span>
                    <span title="Battles">⚔️ ${stats.matchCount}</span>
                </div>
            `;
            card.onclick = async () => {
                await callbacks.onLoadGame(handle, name);
            };
            list.appendChild(card);
        });
    }

    // Hijack the "New Session" form for "New Game Folder"
    const form = document.getElementById('new-session-form') as HTMLFormElement;

    // Update labels to reflect we are creating a folder
    const legend = form.querySelector('h2'); // It's an h2 in the new HTML, check index.html
    if (legend) legend.textContent = 'New Game';
    // Wait, the HTML has <h2>New Game</h2>. 
    // We might want to change it to "New Game" if needed, but "New Game" is cool.

    form.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-session-name') as HTMLInputElement;
        const kInput = document.getElementById('new-session-k') as HTMLInputElement;
        const gameName = nameInput.value.trim();

        if (gameName) {
            const kFactor = parseInt(kInput.value) || 60;
            await callbacks.onCreateGame(gameName, kFactor);
        }
    };
}
