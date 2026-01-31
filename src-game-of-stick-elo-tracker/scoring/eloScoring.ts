/**
 * Game of STICK - ELO Tracker
 * ELO Scoring System Implementation
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { ScoringSystem, ScoringResult, MatchOutcome, ScoringConfig } from './scoringTypes';

/**
 * Default ELO configuration
 */
export const DEFAULT_ELO_CONFIG: ScoringConfig = {
    initialRating: 1200,
    parameters: {
        kFactor: 60,
        scalingFactor: 400  // Standard ELO scaling factor
    }
};

/**
 * ELO Scoring System
 * 
 * Implements the ELO rating system used in chess and many competitive games.
 * The formula calculates expected scores based on rating differences
 * and adjusts ratings based on actual vs expected performance.
 */
export class EloScoringSystem implements ScoringSystem {
    readonly name = 'elo';
    private config: ScoringConfig;

    constructor(config: Partial<ScoringConfig> = {}) {
        this.config = {
            initialRating: config.initialRating ?? DEFAULT_ELO_CONFIG.initialRating,
            parameters: {
                ...DEFAULT_ELO_CONFIG.parameters,
                ...config.parameters
            }
        };
    }

    /**
     * Get the initial rating for new players
     */
    getInitialRating(): number {
        return this.config.initialRating;
    }

    /**
     * Get the default K-factor
     */
    getDefaultKFactor(): number {
        return this.config.parameters.kFactor;
    }

    /**
     * Calculate expected score (win probability) for player 1 against player 2.
     * This is the centralized ELO expected score formula.
     * 
     * @param p1Rating - Player 1's current rating
     * @param p2Rating - Player 2's current rating
     * @returns Expected score between 0 and 1 (0.5 means equal chance)
     */
    getExpectedScore(p1Rating: number, p2Rating: number): number {
        const scalingFactor = this.config.parameters.scalingFactor;
        return 1 / (1 + 10 ** ((p2Rating - p1Rating) / scalingFactor));
    }

    /**
     * Calculate new ratings after a match
     * 
     * @param p1Rating - Player 1's current rating
     * @param p2Rating - Player 2's current rating
     * @param outcome - Match outcome
     * @param kFactor - Optional K-factor override (uses default if not provided)
     */
    calculateNewRatings(
        p1Rating: number,
        p2Rating: number,
        outcome: MatchOutcome,
        kFactor?: number
    ): ScoringResult {
        const k = kFactor ?? this.config.parameters.kFactor;

        const expectedScoreP1 = this.getExpectedScore(p1Rating, p2Rating);
        const expectedScoreP2 = 1 - expectedScoreP1;

        let actualScoreP1: number;
        let actualScoreP2: number;

        if (outcome === 'p1') {
            actualScoreP1 = 1;
            actualScoreP2 = 0;
        } else if (outcome === 'p2') {
            actualScoreP1 = 0;
            actualScoreP2 = 1;
        } else {
            actualScoreP1 = 0.5;
            actualScoreP2 = 0.5;
        }

        const p1Change = Math.round(k * (actualScoreP1 - expectedScoreP1));
        const p2Change = Math.round(k * (actualScoreP2 - expectedScoreP2));

        return {
            newP1Rating: p1Rating + p1Change,
            newP2Rating: p2Rating + p2Change,
            p1Change,
            p2Change
        };
    }
}

// Default instance for convenience
export const eloScoring = new EloScoringSystem();
