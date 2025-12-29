/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Tests for Registry Utilities
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeAlias,
    findPlayerByName,
    findPlayerById,
    createGlobalPlayer,
    addAliasToPlayer,
    getPlayerAge,
    filterByAge
} from '../../utils/registryUtils';
import { GlobalPlayer } from '../../types/registryTypes';

describe('Registry Utilities', () => {
    describe('normalizeAlias', () => {
        it('should lowercase the name', () => {
            expect(normalizeAlias('Pierre')).toBe('pierre');
        });

        it('should trim whitespace', () => {
            expect(normalizeAlias('  Pierre  ')).toBe('pierre');
        });

        it('should remove diacritics', () => {
            expect(normalizeAlias('Éloïse')).toBe('eloise');
            expect(normalizeAlias('François')).toBe('francois');
        });

        it('should collapse multiple spaces', () => {
            expect(normalizeAlias('Pierre   Puchaud')).toBe('pierre puchaud');
        });

        it('should handle combined transformations', () => {
            expect(normalizeAlias('  ÉLOÏSE   MARIE  ')).toBe('eloise marie');
        });
    });

    describe('findPlayerByName', () => {
        const registry: GlobalPlayer[] = [
            {
                id: 'gp-123',
                name: 'Pierre',
                aliases: ['pierre', 'pierrot'],
                status: 'ACTIVE',
                createdAt: Date.now()
            },
            {
                id: 'gp-456',
                name: 'Thomas',
                aliases: ['thomas'],
                status: 'ACTIVE',
                createdAt: Date.now()
            }
        ];

        it('should find player by exact name', () => {
            const player = findPlayerByName(registry, 'Pierre');
            expect(player).not.toBeNull();
            expect(player!.id).toBe('gp-123');
        });

        it('should find player by alias', () => {
            const player = findPlayerByName(registry, 'pierrot');
            expect(player).not.toBeNull();
            expect(player!.id).toBe('gp-123');
        });

        it('should be case-insensitive', () => {
            const player = findPlayerByName(registry, 'PIERRE');
            expect(player).not.toBeNull();
            expect(player!.id).toBe('gp-123');
        });

        it('should return null for unknown name', () => {
            const player = findPlayerByName(registry, 'Unknown');
            expect(player).toBeNull();
        });
    });

    describe('findPlayerById', () => {
        const registry: GlobalPlayer[] = [
            {
                id: 'gp-123',
                name: 'Pierre',
                aliases: ['pierre'],
                status: 'ACTIVE',
                createdAt: Date.now()
            }
        ];

        it('should find player by ID', () => {
            const player = findPlayerById(registry, 'gp-123');
            expect(player).not.toBeNull();
            expect(player!.name).toBe('Pierre');
        });

        it('should return null for unknown ID', () => {
            const player = findPlayerById(registry, 'gp-unknown');
            expect(player).toBeNull();
        });
    });

    describe('createGlobalPlayer', () => {
        it('should create player with ID prefix', () => {
            const player = createGlobalPlayer('Pierre');
            expect(player.id).toMatch(/^gp-/);
        });

        it('should set correct name and status', () => {
            const player = createGlobalPlayer('Pierre');
            expect(player.name).toBe('Pierre');
            expect(player.status).toBe('ACTIVE');
        });

        it('should include normalized alias', () => {
            const player = createGlobalPlayer('Pierre');
            expect(player.aliases).toContain('pierre');
        });

        it('should trim the input name', () => {
            const player = createGlobalPlayer('  Pierre  ');
            expect(player.name).toBe('Pierre');
        });
    });

    describe('addAliasToPlayer', () => {
        it('should add new alias', () => {
            const player: GlobalPlayer = {
                id: 'gp-123',
                name: 'Pierre',
                aliases: ['pierre'],
                status: 'ACTIVE',
                createdAt: Date.now()
            };
            const added = addAliasToPlayer(player, 'pierrot');
            expect(added).toBe(true);
            expect(player.aliases).toContain('pierrot');
        });

        it('should not add duplicate alias', () => {
            const player: GlobalPlayer = {
                id: 'gp-123',
                name: 'Pierre',
                aliases: ['pierre', 'pierrot'],
                status: 'ACTIVE',
                createdAt: Date.now()
            };
            const added = addAliasToPlayer(player, 'PIERROT'); // Same normalized
            expect(added).toBe(false);
            expect(player.aliases.length).toBe(2);
        });
    });

    describe('getPlayerAge', () => {
        it('should return null if no birth date', () => {
            const player: GlobalPlayer = {
                id: 'gp-123',
                name: 'Pierre',
                aliases: [],
                status: 'ACTIVE',
                createdAt: Date.now()
            };
            expect(getPlayerAge(player)).toBeNull();
        });

        it('should calculate correct age', () => {
            const today = new Date();
            const tenYearsAgo = new Date(today.getFullYear() - 10, 0, 1);
            const player: GlobalPlayer = {
                id: 'gp-123',
                name: 'Pierre',
                aliases: [],
                birthDate: tenYearsAgo.toISOString().split('T')[0],
                status: 'ACTIVE',
                createdAt: Date.now()
            };
            expect(getPlayerAge(player)).toBe(10);
        });
    });

    describe('filterByAge', () => {
        const makePlayer = (name: string, birthDate?: string): GlobalPlayer => ({
            id: `gp-${name}`,
            name,
            aliases: [],
            birthDate,
            status: 'ACTIVE',
            createdAt: Date.now()
        });

        const today = new Date();
        const child = makePlayer('Child', new Date(today.getFullYear() - 10, 0, 1).toISOString().split('T')[0]);
        const adult = makePlayer('Adult', new Date(today.getFullYear() - 25, 0, 1).toISOString().split('T')[0]);
        const unknown = makePlayer('Unknown');

        const players = [child, adult, unknown];

        it('should return all players for "all" filter', () => {
            const result = filterByAge(players, 'all');
            expect(result.length).toBe(3);
        });

        it('should return kids for "kids" filter', () => {
            const result = filterByAge(players, 'kids');
            expect(result).toContain(child);
            expect(result).not.toContain(adult);
            expect(result).toContain(unknown); // Unknown age included
        });

        it('should return adults for "adults" filter', () => {
            const result = filterByAge(players, 'adults');
            expect(result).toContain(adult);
            expect(result).not.toContain(child);
            expect(result).toContain(unknown); // Unknown age included
        });
    });
});
