/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Tests for Scoring Module Exports
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { describe, it, expect } from 'vitest';
import {
    getScoringSystem,
    EloScoringSystem,
    eloScoring,
    DEFAULT_ELO_CONFIG
} from '../../scoring/index';

describe('Scoring Module', () => {
    describe('getScoringSystem factory', () => {
        it('should return EloScoringSystem instance for "elo" type', () => {
            const system = getScoringSystem('elo');
            expect(system).toBeInstanceOf(EloScoringSystem);
            expect(system.name).toBe('elo');
        });

        it('should return EloScoringSystem by default', () => {
            const system = getScoringSystem();
            expect(system).toBeInstanceOf(EloScoringSystem);
        });

        it('should throw for unknown scoring system type', () => {
            // @ts-expect-error Testing invalid type
            expect(() => getScoringSystem('invalid')).toThrow('Unknown scoring system type');
        });
    });

    describe('exports', () => {
        it('should export eloScoring instance', () => {
            expect(eloScoring).toBeInstanceOf(EloScoringSystem);
        });

        it('should export DEFAULT_ELO_CONFIG', () => {
            expect(DEFAULT_ELO_CONFIG).toBeDefined();
            expect(DEFAULT_ELO_CONFIG.initialRating).toBe(1200);
        });

        it('should export EloScoringSystem class', () => {
            expect(EloScoringSystem).toBeDefined();
            const instance = new EloScoringSystem();
            expect(instance.name).toBe('elo');
        });
    });
});
