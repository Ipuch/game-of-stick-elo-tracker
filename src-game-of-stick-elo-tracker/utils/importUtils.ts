/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { eloScoring } from '../scoring';

export function deduceKFromFirstMatch(parts: string[]): number | null {
    // parts: [Timestamp, Player 1, Player 2, Outcome, P1 ELO Before, P1 ELO After, P2 ELO Before, P2 ELO After]
    const p1EloBefore = parseFloat(parts[4]);
    const p1EloAfter = parseFloat(parts[5]);
    const p2EloBefore = parseFloat(parts[6]);
    const outcomeText = parts[3].trim();
    let outcome: 'p1' | 'p2' | 'draw';
    if (outcomeText.includes(parts[1]) && outcomeText.includes('Won')) outcome = 'p1';
    else if (outcomeText.includes(parts[2]) && outcomeText.includes('Won')) outcome = 'p2';
    else if (outcomeText === 'Draw') outcome = 'draw';
    else return null;
    // ELO formula using centralized scoring
    const expectedScoreP1 = eloScoring.getExpectedScore(p1EloBefore, p2EloBefore);
    let actualScoreP1: number;
    if (outcome === 'p1') actualScoreP1 = 1;
    else if (outcome === 'p2') actualScoreP1 = 0;
    else actualScoreP1 = 0.5;
    const delta = p1EloAfter - p1EloBefore;
    const denominator = actualScoreP1 - expectedScoreP1;
    if (Math.abs(denominator) < 1e-6) return null; // Avoid division by zero
    const k = delta / denominator;
    return Math.round(k);
}
