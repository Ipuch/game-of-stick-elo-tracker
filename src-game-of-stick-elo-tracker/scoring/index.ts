/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Scoring Module - Main Entry Point
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

// Export types
export type {
    ScoringConfig,
    ScoringResult,
    ScoringSystem,
    ScoringSystemType,
    MatchOutcome
} from './scoringTypes';

// Export ELO implementation
export { EloScoringSystem, eloScoring, DEFAULT_ELO_CONFIG } from './eloScoring';

// Factory function for future extensibility
import { ScoringSystem, ScoringSystemType } from './scoringTypes';
import { EloScoringSystem } from './eloScoring';

/**
 * Get a scoring system instance by type.
 * Use this factory to support multiple scoring methods in the future.
 */
export function getScoringSystem(type: ScoringSystemType = 'elo'): ScoringSystem {
    switch (type) {
        case 'elo':
            return new EloScoringSystem();
        default:
            throw new Error(`Unknown scoring system type: ${type}`);
    }
}
