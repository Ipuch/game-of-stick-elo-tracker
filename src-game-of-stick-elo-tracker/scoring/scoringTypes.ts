/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Scoring system types and interfaces
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

/**
 * Configuration for a scoring system
 */
export interface ScoringConfig {
    /** Initial rating for new players */
    initialRating: number;
    /** System-specific parameters (e.g., K-factor for ELO) */
    parameters: Record<string, number>;
}

/**
 * Result of a rating calculation
 */
export interface ScoringResult {
    /** New rating for player 1 */
    newP1Rating: number;
    /** New rating for player 2 */
    newP2Rating: number;
    /** Rating change for player 1 */
    p1Change: number;
    /** Rating change for player 2 */
    p2Change: number;
}

/**
 * Match outcome type
 */
export type MatchOutcome = 'p1' | 'p2' | 'draw';

/**
 * Interface for a scoring system implementation.
 * Implement this interface to add new scoring methods (e.g., Glicko, TrueSkill).
 */
export interface ScoringSystem {
    /** Unique identifier for the scoring system */
    readonly name: string;

    /** Get the initial rating for new players */
    getInitialRating(): number;

    /**
     * Calculate expected score (win probability) for player 1 against player 2
     * @param p1Rating - Player 1's current rating
     * @param p2Rating - Player 2's current rating
     * @returns Expected score between 0 and 1
     */
    getExpectedScore(p1Rating: number, p2Rating: number): number;

    /**
     * Calculate new ratings after a match
     * @param p1Rating - Player 1's current rating
     * @param p2Rating - Player 2's current rating
     * @param outcome - Match outcome ('p1' wins, 'p2' wins, or 'draw')
     * @param kFactor - Optional K-factor override (for ELO-based systems)
     */
    calculateNewRatings(
        p1Rating: number,
        p2Rating: number,
        outcome: MatchOutcome,
        kFactor?: number
    ): ScoringResult;
}

/**
 * Available scoring system types
 */
export type ScoringSystemType = 'elo';
