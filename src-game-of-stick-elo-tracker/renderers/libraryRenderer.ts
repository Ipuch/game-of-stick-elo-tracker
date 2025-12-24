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
