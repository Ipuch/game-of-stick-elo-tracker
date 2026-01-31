/**
 * Game of STICK - ELO Tracker
 * Tests for ELO Scoring System
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { describe, it, expect } from 'vitest';
import { EloScoringSystem, eloScoring, DEFAULT_ELO_CONFIG } from '../../scoring/eloScoring';

describe('EloScoringSystem', () => {
    describe('getInitialRating', () => {
        it('should return default initial rating of 1200', () => {
            expect(eloScoring.getInitialRating()).toBe(1200);
        });

        it('should return custom initial rating when configured', () => {
            const customScoring = new EloScoringSystem({ initialRating: 1500 });
            expect(customScoring.getInitialRating()).toBe(1500);
        });
    });

    describe('getDefaultKFactor', () => {
        it('should return default K-factor of 60', () => {
            expect(eloScoring.getDefaultKFactor()).toBe(60);
        });

        it('should return custom K-factor when configured', () => {
            const customScoring = new EloScoringSystem({
                parameters: { kFactor: 32 }
            });
            expect(customScoring.getDefaultKFactor()).toBe(32);
        });
    });

    describe('getExpectedScore', () => {
        it('should return 0.5 for equal ratings', () => {
            const expected = eloScoring.getExpectedScore(1200, 1200);
            expect(expected).toBeCloseTo(0.5, 5);
        });

        it('should return higher score for higher rated player', () => {
            const expected = eloScoring.getExpectedScore(1400, 1200);
            expect(expected).toBeGreaterThan(0.5);
            expect(expected).toBeCloseTo(0.76, 2); // ~76% for 200 point difference
        });

        it('should return lower score for lower rated player', () => {
            const expected = eloScoring.getExpectedScore(1200, 1400);
            expect(expected).toBeLessThan(0.5);
            expect(expected).toBeCloseTo(0.24, 2); // ~24% for -200 point difference
        });

        it('should return complementary scores for swapped players', () => {
            const score1 = eloScoring.getExpectedScore(1300, 1200);
            const score2 = eloScoring.getExpectedScore(1200, 1300);
            expect(score1 + score2).toBeCloseTo(1.0, 5);
        });

        it('should handle extreme rating differences', () => {
            const expected = eloScoring.getExpectedScore(1800, 1200);
            expect(expected).toBeGreaterThan(0.9); // Very high probability for 600 point difference
        });
    });

    describe('calculateNewRatings', () => {
        describe('with equal ratings (1200 vs 1200)', () => {
            it('should award points to winner (p1 wins)', () => {
                const result = eloScoring.calculateNewRatings(1200, 1200, 'p1', 60);
                expect(result.newP1Rating).toBe(1230); // +30
                expect(result.newP2Rating).toBe(1170); // -30
                expect(result.p1Change).toBe(30);
                expect(result.p2Change).toBe(-30);
            });

            it('should award points to winner (p2 wins)', () => {
                const result = eloScoring.calculateNewRatings(1200, 1200, 'p2', 60);
                expect(result.newP1Rating).toBe(1170); // -30
                expect(result.newP2Rating).toBe(1230); // +30
                expect(result.p1Change).toBe(-30);
                expect(result.p2Change).toBe(30);
            });

            it('should keep ratings unchanged on draw', () => {
                const result = eloScoring.calculateNewRatings(1200, 1200, 'draw', 60);
                expect(result.newP1Rating).toBe(1200);
                expect(result.newP2Rating).toBe(1200);
                expect(result.p1Change).toBe(0);
                expect(result.p2Change).toBe(0);
            });
        });

        describe('with different ratings', () => {
            it('should give more points when underdog wins', () => {
                // Lower rated player (1200) beats higher rated (1400)
                const result = eloScoring.calculateNewRatings(1200, 1400, 'p1', 60);
                expect(result.p1Change).toBeGreaterThan(30); // More than even match
                expect(result.p2Change).toBeLessThan(-30);   // More penalty for losing to underdog
            });

            it('should give fewer points when favorite wins', () => {
                // Higher rated player (1400) beats lower rated (1200)
                const result = eloScoring.calculateNewRatings(1400, 1200, 'p1', 60);
                expect(result.p1Change).toBeLessThan(30);   // Less than even match
                expect(result.p2Change).toBeGreaterThan(-30); // Less penalty for expected loss
            });
        });

        describe('K-factor variations', () => {
            it('should scale rating changes with K-factor', () => {
                const resultK60 = eloScoring.calculateNewRatings(1200, 1200, 'p1', 60);
                const resultK32 = eloScoring.calculateNewRatings(1200, 1200, 'p1', 32);

                expect(resultK60.p1Change).toBe(30);  // K=60: +30
                expect(resultK32.p1Change).toBe(16);  // K=32: +16
            });

            it('should use default K-factor when not specified', () => {
                const result = eloScoring.calculateNewRatings(1200, 1200, 'p1');
                expect(result.p1Change).toBe(30); // Default K=60, so +30
            });
        });

        describe('rating change symmetry', () => {
            it('should have zero-sum rating changes', () => {
                const result = eloScoring.calculateNewRatings(1350, 1250, 'p1', 60);
                expect(result.p1Change + result.p2Change).toBe(0);
            });

            it('should maintain zero-sum for draws at different ratings', () => {
                const result = eloScoring.calculateNewRatings(1400, 1200, 'draw', 60);
                expect(result.p1Change + result.p2Change).toBe(0);
            });
        });
    });

    describe('DEFAULT_ELO_CONFIG', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_ELO_CONFIG.initialRating).toBe(1200);
            expect(DEFAULT_ELO_CONFIG.parameters.kFactor).toBe(60);
            expect(DEFAULT_ELO_CONFIG.parameters.scalingFactor).toBe(400);
        });
    });
});
