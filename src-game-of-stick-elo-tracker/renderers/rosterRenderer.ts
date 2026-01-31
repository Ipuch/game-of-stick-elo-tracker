/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * @license Apache-2.0
 */

import { Player } from '../types/appTypes';

export function renderRosterList(players: Player[], rosterListElement: HTMLElement | undefined) {
    if (!rosterListElement) return;
    rosterListElement.innerHTML = '';

    // Sort alphabetically
    const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.innerHTML = `<span>${p.name}</span> <span class="elo">${p.elo}</span>`;
        rosterListElement.appendChild(chip);
    });
}
