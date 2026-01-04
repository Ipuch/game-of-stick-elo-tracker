/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Registry Manager UI
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { GlobalPlayer, AgeCategory } from '../types/registryTypes';
import { store } from '../state/store';
import { saveRegistry } from '../utils/registryPersistence';
import { getPlayerAge, filterByAge, normalizeAlias, createGlobalPlayer, findPlayerByName } from '../utils/registryUtils';
import { showNotification } from '../ui/notificationSystem';
import { listGamesInLibrary, loadGameFromSession } from '../utils/fileSystemPersistence';
import { t } from '../utils/i18n';

export type RegistryManagerCallbacks = {
    onBack: () => void;
};

let currentAgeFilter: AgeCategory = 'all';

/**
 * Render the Registry Manager view.
 * Shows all global players with edit/filter capabilities.
 */
export function renderRegistryManager(callbacks: RegistryManagerCallbacks) {
    const container = document.getElementById('registry-manager-view');
    if (!container) return;

    // Hide other views
    const menuEl = document.getElementById('game-menu');
    const mainEl = document.getElementById('app-main');
    const dashboardEl = document.getElementById('aggregated-dashboard');
    if (menuEl) menuEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'none';
    if (dashboardEl) dashboardEl.style.display = 'none';

    container.style.display = 'block';

    // Filter and sort players alphabetically
    const filteredPlayers = filterByAge(store.registry, currentAgeFilter)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    container.innerHTML = `
        <div class="registry-manager">
            <header class="registry-header">
                <button id="registry-back-btn" class="button-secondary">${t('aggregated.backToLibrary')}</button>
                <h1>${t('registry.title')}</h1>
                <p class="registry-subtitle">${store.registry.length} ${t('registry.playersInLibrary')}</p>
            </header>

            <div class="registry-controls">
                <div class="age-filter-group">
                    <label>${t('registry.ageFilter')}</label>
                    <div class="filter-buttons">
                        <button class="filter-btn ${currentAgeFilter === 'all' ? 'active' : ''}" data-filter="all">${t('registry.all')}</button>
                        <button class="filter-btn ${currentAgeFilter === 'kids' ? 'active' : ''}" data-filter="kids">${t('registry.kids')}</button>
                        <button class="filter-btn ${currentAgeFilter === 'adults' ? 'active' : ''}" data-filter="adults">${t('registry.adults')}</button>
                    </div>
                </div>
                <button id="bootstrap-registry-btn" class="button-primary bootstrap-btn">${t('registry.importFromGames')}</button>
            </div>

            <div class="registry-list">
                ${filteredPlayers.length === 0
            ? `<div class="empty-registry">${t('registry.empty')}</div>`
            : filteredPlayers.map(player => renderPlayerCard(player)).join('')
        }
            </div>
        </div>
    `;

    // Attach event listeners
    document.getElementById('registry-back-btn')?.addEventListener('click', () => {
        hideRegistryManager();
        callbacks.onBack();
    });

    // Age filter buttons
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAgeFilter = (btn as HTMLElement).dataset.filter as AgeCategory;
            renderRegistryManager(callbacks);
        });
    });

    // Edit buttons
    container.querySelectorAll('.player-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = (btn as HTMLElement).dataset.id!;
            openEditModal(playerId, callbacks);
        });
    });

    // Status toggle buttons
    container.querySelectorAll('.player-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const playerId = (btn as HTMLElement).dataset.id!;
            await togglePlayerStatus(playerId);
            renderRegistryManager(callbacks);
        });
    });

    // Bootstrap button
    document.getElementById('bootstrap-registry-btn')?.addEventListener('click', async () => {
        await bootstrapRegistryFromGames(callbacks);
    });
}

function renderPlayerCard(player: GlobalPlayer): string {
    const age = getPlayerAge(player);
    const ageDisplay = age !== null ? `${age}${t('registry.yo')}` : '';
    const aliasesDisplay = player.aliases
        .filter(a => normalizeAlias(a) !== normalizeAlias(player.name))
        .slice(0, 3)
        .join(', ');

    return `
        <div class="player-card ${player.status === 'INACTIVE' ? 'inactive' : ''}">
            <div class="player-main-info">
                <div class="player-identity">
                    <span class="player-name">${player.name}</span>
                    ${ageDisplay ? `<span class="player-age-badge">${ageDisplay}</span>` : ''}
                </div>
                ${player.status === 'INACTIVE' ? `<span class="status-badge inactive">${t('registry.inactive')}</span>` : ''}
            </div>
            <div class="player-details">
                ${aliasesDisplay ? `<span class="player-aliases">${t('registry.aka')}: ${aliasesDisplay}</span>` : ''}
            </div>
            <div class="player-actions">
                <button class="button-secondary player-edit-btn" data-id="${player.id}">${t('registry.edit')}</button>
                <button class="button-secondary player-status-btn" data-id="${player.id}">
                    ${player.status === 'ACTIVE' ? t('registry.deactivate') : t('registry.activate')}
                </button>
            </div>
        </div>
    `;
}

async function togglePlayerStatus(playerId: string) {
    const player = store.registry.find(p => p.id === playerId);
    if (!player) return;

    player.status = player.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (store.libraryHandle) {
        try {
            await saveRegistry(store.libraryHandle, store.registry);
            showNotification(t('registry.statusChanged', player.name, player.status === 'ACTIVE' ? t('registry.statusActive') : t('registry.statusInactive')));
        } catch (e) {
            showNotification(t('notifications.error'), 'error');
        }
    }
}

function openEditModal(playerId: string, callbacks: RegistryManagerCallbacks) {
    const player = store.registry.find(p => p.id === playerId);
    if (!player) return;

    const modal = document.createElement('div');
    modal.className = 'registry-modal-overlay';
    modal.id = 'registry-edit-modal';
    modal.innerHTML = `
        <div class="registry-modal">
            <h2>${t('registry.editPlayer')}</h2>
            <form id="edit-player-form">
                <div class="form-group">
                    <label for="edit-player-name">${t('registry.name')}</label>
                    <input type="text" id="edit-player-name" value="${player.name}" required />
                </div>
                <div class="form-group">
                    <label for="edit-player-birthdate">${t('registry.birthDate')}</label>
                    <input type="date" id="edit-player-birthdate" value="${player.birthDate || ''}" />
                </div>
                <div class="form-group">
                    <label for="edit-player-aliases">${t('registry.aliases')}</label>
                    <input type="text" id="edit-player-aliases" value="${player.aliases.join(', ')}" />
                </div>
                <div class="modal-actions">
                    <button type="button" class="button-secondary" id="cancel-edit-btn">${t('registry.cancel')}</button>
                    <button type="submit" class="button-primary">${t('registry.saveChanges')}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Save handler
    document.getElementById('edit-player-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('edit-player-name') as HTMLInputElement;
        const birthdateInput = document.getElementById('edit-player-birthdate') as HTMLInputElement;
        const aliasesInput = document.getElementById('edit-player-aliases') as HTMLInputElement;

        player.name = nameInput.value.trim();
        player.birthDate = birthdateInput.value || undefined;
        player.aliases = aliasesInput.value
            .split(',')
            .map(a => a.trim())
            .filter(a => a.length > 0);

        // Ensure normalized name is in aliases
        const normalizedName = normalizeAlias(player.name);
        if (!player.aliases.some(a => normalizeAlias(a) === normalizedName)) {
            player.aliases.push(normalizedName);
        }

        if (store.libraryHandle) {
            try {
                await saveRegistry(store.libraryHandle, store.registry);
                showNotification(t('registry.updated', player.name));
            } catch (err) {
                showNotification(t('notifications.error'), 'error');
            }
        }

        modal.remove();
        renderRegistryManager(callbacks);
    });
}

export function hideRegistryManager() {
    const container = document.getElementById('registry-manager-view');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

/**
 * Scan all games in the library and import unique players into the registry.
 * Uses normalized name matching to merge similar names (e.g., "Pierre" = "pierre").
 */
async function bootstrapRegistryFromGames(callbacks: RegistryManagerCallbacks) {
    if (!store.libraryHandle) {
        showNotification(t('registry.noLibrary'), 'error');
        return;
    }

    showNotification(t('registry.scanning'));

    try {
        const games = await listGamesInLibrary(store.libraryHandle);
        let importedCount = 0;
        let skippedCount = 0;

        for (const game of games) {
            try {
                const state = await loadGameFromSession(game.handle);

                for (const player of state.players) {
                    // Check if player already exists in registry (by normalized name)
                    const existing = findPlayerByName(store.registry, player.name);

                    if (existing) {
                        // Player exists, just add this name as alias if different
                        const normalized = normalizeAlias(player.name);
                        if (!existing.aliases.some(a => normalizeAlias(a) === normalized)) {
                            existing.aliases.push(player.name);
                        }
                        skippedCount++;
                    } else {
                        // New player - create in registry
                        const newPlayer = createGlobalPlayer(player.name);
                        store.registry.push(newPlayer);
                        importedCount++;
                    }
                }
            } catch (e) {
                console.warn(`Failed to load game ${game.name}:`, e);
            }
        }

        // Save registry
        await saveRegistry(store.libraryHandle, store.registry);

        showNotification(t('registry.importedMsg', importedCount.toString(), skippedCount.toString()), 'success');
        renderRegistryManager(callbacks);

    } catch (e) {
        console.error('Bootstrap failed:', e);
        showNotification(t('registry.importFailed'), 'error');
    }
}

