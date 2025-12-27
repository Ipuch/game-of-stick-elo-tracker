/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { listGamesInLibrary } from '../utils/fileSystemPersistence';

export type LibraryCallbacks = {
    onLoadGame: (handle: FileSystemDirectoryHandle, name: string) => Promise<void>;
    onCreateGame: (name: string, kFactor: number) => Promise<void>;
    onViewAggregatedStats: () => void;
};

export async function renderGameLibrary(
    libraryHandle: FileSystemDirectoryHandle,
    callbacks: LibraryCallbacks
) {
    const games = await listGamesInLibrary(libraryHandle);

    document.getElementById('game-menu')!.style.display = 'flex';
    document.getElementById('app-main')!.style.display = 'none';

    // Update Menu Header or Title to indicate Library Mode could be nice, but reusing current structure
    const list = document.getElementById('session-list')!;
    list.innerHTML = '';

    // Header for Library
    const libraryHeader = document.createElement('h3');
    libraryHeader.textContent = `Library: ${libraryHandle.name}`;
    libraryHeader.style.width = '100%';
    libraryHeader.style.textAlign = 'center';
    libraryHeader.style.color = 'var(--text-muted)';
    list.appendChild(libraryHeader);

    // Aggregated Stats Button
    if (games.length > 0) {
        const aggBtnContainer = document.createElement('div');
        aggBtnContainer.className = 'agg-stats-btn-container';
        aggBtnContainer.style.width = '100%';
        aggBtnContainer.style.textAlign = 'center';
        aggBtnContainer.style.marginBottom = '1rem';

        const aggBtn = document.createElement('button');
        aggBtn.className = 'button-secondary agg-stats-btn';
        aggBtn.innerHTML = '📊 View Aggregated Stats';
        aggBtn.style.width = '100%';
        aggBtn.style.padding = '0.75rem';
        aggBtn.onclick = () => callbacks.onViewAggregatedStats();
        aggBtnContainer.appendChild(aggBtn);
        list.appendChild(aggBtnContainer);

        const divider = document.createElement('hr');
        divider.style.width = '100%';
        divider.style.margin = '0.5rem 0 1rem 0';
        divider.style.opacity = '0.3';
        list.appendChild(divider);
    }

    if (games.length === 0) {
        const msg = document.createElement('div');
        msg.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1rem;">No games found in this folder. Create one below!</div>';
        list.appendChild(msg);
    } else {
        games.forEach(g => {
            const card = document.createElement('div');
            card.className = 'session-item';
            // We don't have metadata easily without reading every folder, so just show name
            card.innerHTML = `
                <div class="session-info">
                    <h3>${g.name}</h3>
                    <div class="session-meta">Folder Game</div>
                </div>
                <div class="session-arrow">➜</div>
            `;
            card.onclick = async () => {
                await callbacks.onLoadGame(g.handle, g.name);
            };
            list.appendChild(card);
        });
    }

    // Hijack the "New Session" form for "New Game Folder"
    const form = document.getElementById('new-session-form') as HTMLFormElement;

    // Update labels to reflect we are creating a folder
    const legend = form.querySelector('legend');
    if (legend) legend.textContent = 'Create New Game in Library';

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
