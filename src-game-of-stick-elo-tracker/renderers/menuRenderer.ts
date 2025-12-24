/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { getLastLibraryName } from '../utils/localStoragePersistence';
import { EXAMPLE_GAME_NAME } from '../utils/exampleGameData';

export type MenuCallbacks = {
    onOpenLibrary: () => void;
    onLoadExample: () => void;
    onStartNewGame: (name: string, kFactor: number) => void;
    renderLibrary: () => void;
};

export function renderGameMenu(
    store: { libraryHandle: FileSystemDirectoryHandle | null },
    callbacks: MenuCallbacks
) {
    // If we have a library loaded, render that instead
    if (store.libraryHandle) {
        callbacks.renderLibrary();
        return;
    }

    document.getElementById('game-menu')!.style.display = 'flex';
    document.getElementById('app-main')!.style.display = 'none';

    const list = document.getElementById('session-list')!;
    list.innerHTML = '';

    // Get last used library name for hint
    const lastLibraryName = getLastLibraryName();

    // Single button to choose save location (load existing games)
    const openFolderBtnContainer = document.createElement('div');
    openFolderBtnContainer.style.width = '100%';
    openFolderBtnContainer.style.textAlign = 'center';
    openFolderBtnContainer.style.marginBottom = '20px';

    const openFolderBtn = document.createElement('button');
    openFolderBtn.id = 'open-library-btn';
    openFolderBtn.className = 'button-primary';
    openFolderBtn.style.width = '100%';
    openFolderBtn.style.fontSize = '1.1rem';
    openFolderBtn.style.padding = '1rem';
    openFolderBtn.textContent = '📂 Load Saved Games';
    openFolderBtn.onclick = callbacks.onOpenLibrary;

    openFolderBtnContainer.appendChild(openFolderBtn);

    // Show hint if there's a last used library
    if (lastLibraryName) {
        const hint = document.createElement('p');
        hint.className = 'form-hint';
        hint.style.textAlign = 'center';
        hint.style.marginTop = '0.5rem';
        hint.innerHTML = `Last used: <strong>${lastLibraryName}</strong>`;
        openFolderBtnContainer.appendChild(hint);
    }

    list.appendChild(openFolderBtnContainer);

    const divider = document.createElement('hr');
    divider.style.width = '100%';
    divider.style.margin = '1.5rem 0';
    list.appendChild(divider);

    // EXAMPLE GAME card
    const exampleCard = document.createElement('div');
    exampleCard.className = 'session-item';
    exampleCard.innerHTML = `
        <div class="session-info">
            <h3>🎮 ${EXAMPLE_GAME_NAME}</h3>
            <div class="session-meta">Demo with sample players & matches</div>
        </div>
        <div class="session-arrow">➜</div>
    `;
    exampleCard.onclick = callbacks.onLoadExample;
    list.appendChild(exampleCard);

    // Show and setup the new session form
    const form = document.getElementById('new-session-form') as HTMLFormElement;
    if (form) {
        form.style.display = 'block';
        form.onsubmit = (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-session-name') as HTMLInputElement;
            const kInput = document.getElementById('new-session-k') as HTMLInputElement;

            if (nameInput.value) {
                // Start a new game with empty state (no folder yet)
                callbacks.onStartNewGame(nameInput.value.trim(), parseInt(kInput.value) || 60);
            }
        };
    }
}
