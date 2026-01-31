/**
 * Game of STICK - ELO Tracker
 * Registry Utilities
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { GlobalPlayer } from '../types/registryTypes';
import { nanoid } from 'nanoid';

/**
 * Generate a unique player ID for the registry.
 * Format: "gp-" + 8 character random string
 */
export function generatePlayerId(): string {
    return `gp-${nanoid(8)}`;
}

/**
 * Normalize a player name or alias for matching.
 * - Lowercase
 * - Trim whitespace
 * - Remove diacritics (é → e)
 * - Collapse multiple spaces
 */
export function normalizeAlias(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/\s+/g, ' ');           // Collapse whitespace
}

/**
 * Find a player in the registry by name or alias.
 * Uses normalized matching for case-insensitive, accent-insensitive lookup.
 * 
 * @param registry - Array of global players to search
 * @param name - Name to search for
 * @returns The matching GlobalPlayer or null if not found
 */
export function findPlayerByName(
    registry: GlobalPlayer[],
    name: string
): GlobalPlayer | null {
    const normalized = normalizeAlias(name);

    for (const player of registry) {
        // Check canonical name
        if (normalizeAlias(player.name) === normalized) {
            return player;
        }
        // Check aliases
        if (player.aliases.some(alias => normalizeAlias(alias) === normalized)) {
            return player;
        }
    }

    return null;
}

/**
 * Find a player in the registry by their ID.
 */
export function findPlayerById(
    registry: GlobalPlayer[],
    id: string
): GlobalPlayer | null {
    return registry.find(p => p.id === id) || null;
}

/**
 * Create a new GlobalPlayer with the given name.
 * Automatically sets up aliases with the normalized version of the name.
 */
export function createGlobalPlayer(name: string, birthDate?: string): GlobalPlayer {
    const normalized = normalizeAlias(name);
    const aliases = [normalized];

    // If original name differs from normalized (e.g., has capitals), add both
    if (name.trim() !== normalized) {
        aliases.push(name.trim());
    }

    return {
        id: generatePlayerId(),
        name: name.trim(),
        aliases,
        birthDate: birthDate || undefined,
        status: 'ACTIVE',
        createdAt: Date.now(),
    };
}

/**
 * Add an alias to a player if it doesn't already exist.
 * Returns true if alias was added, false if it already existed.
 */
export function addAliasToPlayer(player: GlobalPlayer, alias: string): boolean {
    const normalized = normalizeAlias(alias);

    if (player.aliases.some(a => normalizeAlias(a) === normalized)) {
        return false; // Already exists
    }

    player.aliases.push(normalized);
    return true;
}

/**
 * Calculate a player's age based on their birth date.
 * Returns null if no birth date is set.
 */
export function getPlayerAge(player: GlobalPlayer): number | null {
    if (!player.birthDate) return null;

    const birthDate = new Date(player.birthDate);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

/**
 * Filter registry players by age category.
 * Kids: age < 18
 * Adults: age >= 18
 * All: no filtering
 */
export function filterByAge(
    players: GlobalPlayer[],
    category: 'all' | 'kids' | 'adults'
): GlobalPlayer[] {
    if (category === 'all') return players;

    return players.filter(player => {
        const age = getPlayerAge(player);
        if (age === null) return true; // Include players without birth date

        if (category === 'kids') return age < 18;
        if (category === 'adults') return age >= 18;
        return true;
    });
}
