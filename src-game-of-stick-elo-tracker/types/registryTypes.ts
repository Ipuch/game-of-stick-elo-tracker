/**
 * Game of STICK - ELO Tracker
 * Player Registry Types
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

/**
 * A global player identity that persists across game sessions.
 * Stored in saved_games/registry.csv
 */
export interface GlobalPlayer {
    /** Stable unique ID, never changes. Format: "gp-xxxxxxxx" */
    id: string;

    /** Canonical display name */
    name: string;

    /** All known name variations (normalized lowercase). Used for matching. */
    aliases: string[];

    /** Optional birth date in ISO format (YYYY-MM-DD) for age filtering */
    birthDate?: string;

    /** Player status - INACTIVE players are hidden from autocomplete */
    status: 'ACTIVE' | 'INACTIVE';

    /** Timestamp of when the player was added to the registry */
    createdAt: number;
}

/**
 * The full registry structure
 */
export interface PlayerRegistry {
    players: GlobalPlayer[];
}

/**
 * Age category for filtering
 */
export type AgeCategory = 'all' | 'kids' | 'adults';
