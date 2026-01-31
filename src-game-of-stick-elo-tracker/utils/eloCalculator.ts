/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 * 
 * @deprecated This file is deprecated. Import from '../scoring' instead.
 * This file exists only for backward compatibility.
 */

import { eloScoring } from '../scoring';
import { MatchOutcome } from '../scoring';

/**
 * @deprecated Use eloScoring.calculateNewRatings() from '../scoring' instead
 */
export function calculateElo(
  p1Elo: number,
  p2Elo: number,
  winner: MatchOutcome,
  kFactor: number
): { newP1Elo: number; newP2Elo: number } {
  const result = eloScoring.calculateNewRatings(p1Elo, p2Elo, winner, kFactor);
  return {
    newP1Elo: result.newP1Rating,
    newP2Elo: result.newP2Rating
  };
} 