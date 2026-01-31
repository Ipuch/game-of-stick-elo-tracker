/**
 * Game of STICK - ELO Tracker
 * Tests for CSV Utilities
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { describe, it, expect } from 'vitest';
import {
    escapeCsvValue,
    unescapeCsvValue,
    parseCSV,
    playersToCSV,
    csvToPlayers,
    matchesToCSV,
    csvToMatches
} from '../../utils/csvUtils';
import { Player, Match } from '../../types/appTypes';

describe('CSV Utilities', () => {
    describe('escapeCsvValue', () => {
        it('should return string as-is when no special characters', () => {
            expect(escapeCsvValue('simple')).toBe('simple');
        });

        it('should wrap in quotes when value contains comma', () => {
            expect(escapeCsvValue('hello,world')).toBe('"hello,world"');
        });

        it('should wrap in quotes when value contains quotes', () => {
            expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
        });

        it('should wrap in quotes when value contains newline', () => {
            expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
        });

        it('should handle numbers', () => {
            expect(escapeCsvValue(1200)).toBe('1200');
        });

        it('should handle null/undefined', () => {
            expect(escapeCsvValue(null)).toBe('');
            expect(escapeCsvValue(undefined)).toBe('');
        });
    });

    describe('unescapeCsvValue', () => {
        it('should return value as-is when not quoted', () => {
            expect(unescapeCsvValue('simple')).toBe('simple');
        });

        it('should remove surrounding quotes', () => {
            expect(unescapeCsvValue('"quoted"')).toBe('quoted');
        });

        it('should unescape doubled quotes', () => {
            expect(unescapeCsvValue('"say ""hello"""')).toBe('say "hello"');
        });
    });

    describe('parseCSV', () => {
        it('should return empty array for header-only content', () => {
            const result = parseCSV('header1,header2');
            expect(result).toEqual([]);
        });

        it('should return empty array for empty content', () => {
            const result = parseCSV('');
            expect(result).toEqual([]);
        });

        it('should parse simple CSV with one data row', () => {
            const csv = 'name,value\nalice,100';
            const result = parseCSV(csv);
            expect(result).toEqual([['alice', '100']]);
        });

        it('should parse CSV with multiple rows', () => {
            const csv = 'name,value\nalice,100\nbob,200';
            const result = parseCSV(csv);
            expect(result).toEqual([
                ['alice', '100'],
                ['bob', '200']
            ]);
        });

        it('should handle quoted values with commas', () => {
            const csv = 'name,desc\nalice,"hello,world"';
            const result = parseCSV(csv);
            expect(result).toEqual([['alice', 'hello,world']]);
        });

        it('should handle quoted values with escaped quotes', () => {
            const csv = 'name,quote\nalice,"say ""hi"""';
            const result = parseCSV(csv);
            expect(result).toEqual([['alice', 'say "hi"']]);
        });

        it('should skip empty lines', () => {
            const csv = 'name,value\nalice,100\n\nbob,200';
            const result = parseCSV(csv);
            expect(result).toEqual([
                ['alice', '100'],
                ['bob', '200']
            ]);
        });
    });

    describe('playersToCSV / csvToPlayers', () => {
        const samplePlayers: Player[] = [
            {
                id: 'p1',
                name: 'Alice',
                elo: 1250,
                wins: 5,
                losses: 2,
                draws: 1,
                previousRank: 1,
                currentStreakType: 'W',
                currentStreakLength: 3
            },
            {
                id: 'p2',
                name: 'Bob',
                elo: 1150,
                wins: 2,
                losses: 5,
                draws: 1,
                previousRank: 2,
                currentStreakType: 'L',
                currentStreakLength: 2
            }
        ];

        it('should roundtrip players correctly', () => {
            const csv = playersToCSV(samplePlayers);
            const parsed = csvToPlayers(csv);
            
            expect(parsed.length).toBe(2);
            expect(parsed[0].id).toBe('p1');
            expect(parsed[0].name).toBe('Alice');
            expect(parsed[0].elo).toBe(1250);
            expect(parsed[0].wins).toBe(5);
            expect(parsed[0].losses).toBe(2);
            expect(parsed[0].draws).toBe(1);
            expect(parsed[0].currentStreakType).toBe('W');
            expect(parsed[0].currentStreakLength).toBe(3);
        });

        it('should handle player with null streak', () => {
            const playerWithNullStreak: Player[] = [{
                id: 'p3',
                name: 'Charlie',
                elo: 1200,
                wins: 0,
                losses: 0,
                draws: 0,
                previousRank: 0,
                currentStreakType: null,
                currentStreakLength: 0
            }];
            
            const csv = playersToCSV(playerWithNullStreak);
            const parsed = csvToPlayers(csv);
            
            expect(parsed[0].currentStreakType).toBeNull();
        });

        it('should handle player names with special characters', () => {
            const specialPlayer: Player[] = [{
                id: 'p4',
                name: 'Jean-Pierre, Jr.',
                elo: 1200,
                wins: 0,
                losses: 0,
                draws: 0,
                previousRank: 0,
                currentStreakType: null,
                currentStreakLength: 0
            }];
            
            const csv = playersToCSV(specialPlayer);
            const parsed = csvToPlayers(csv);
            
            expect(parsed[0].name).toBe('Jean-Pierre, Jr.');
        });
    });

    describe('matchesToCSV / csvToMatches', () => {
        const sampleMatches: Match[] = [
            {
                id: 'm1',
                timestamp: 1700000000000,
                player1Id: 'p1',
                player2Id: 'p2',
                player1Name: 'Alice',
                player2Name: 'Bob',
                player1EloBefore: 1200,
                player2EloBefore: 1200,
                player1EloAfter: 1230,
                player2EloAfter: 1170,
                outcome: 'p1',
                player1EloChange: 30,
                player2EloChange: -30
            },
            {
                id: 'm2',
                timestamp: 1700001000000,
                player1Id: 'p2',
                player2Id: 'p1',
                player1Name: 'Bob',
                player2Name: 'Alice',
                player1EloBefore: 1170,
                player2EloBefore: 1230,
                player1EloAfter: 1170,
                player2EloAfter: 1230,
                outcome: 'draw',
                player1EloChange: 0,
                player2EloChange: 0
            }
        ];

        it('should roundtrip matches correctly', () => {
            const csv = matchesToCSV(sampleMatches);
            const parsed = csvToMatches(csv);
            
            expect(parsed.length).toBe(2);
            
            const match1 = parsed[0];
            expect(match1.id).toBe('m1');
            expect(match1.timestamp).toBe(1700000000000);
            expect(match1.player1Name).toBe('Alice');
            expect(match1.player2Name).toBe('Bob');
            expect(match1.outcome).toBe('p1');
            expect(match1.player1EloChange).toBe(30);
            expect(match1.player2EloChange).toBe(-30);
        });

        it('should handle all outcome types', () => {
            const outcomes: Match['outcome'][] = ['p1', 'p2', 'draw'];
            
            for (const outcome of outcomes) {
                const match: Match = {
                    ...sampleMatches[0],
                    id: `test-${outcome}`,
                    outcome
                };
                
                const csv = matchesToCSV([match]);
                const parsed = csvToMatches(csv);
                
                expect(parsed[0].outcome).toBe(outcome);
            }
        });

        it('should handle missing ELO change values', () => {
            const matchWithoutChanges: Match = {
                id: 'm3',
                timestamp: 1700002000000,
                player1Id: 'p1',
                player2Id: 'p2',
                player1Name: 'Alice',
                player2Name: 'Bob',
                player1EloBefore: 1200,
                player2EloBefore: 1200,
                player1EloAfter: 1230,
                player2EloAfter: 1170,
                outcome: 'p1'
                // Intentionally missing player1EloChange and player2EloChange
            };
            
            const csv = matchesToCSV([matchWithoutChanges]);
            const parsed = csvToMatches(csv);
            
            expect(parsed[0].player1EloChange).toBe(0);
            expect(parsed[0].player2EloChange).toBe(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle unicode characters in names', () => {
            const player: Player = {
                id: 'p5',
                name: 'Éloïse François',
                elo: 1200,
                wins: 0,
                losses: 0,
                draws: 0,
                previousRank: 0,
                currentStreakType: null,
                currentStreakLength: 0
            };
            
            const csv = playersToCSV([player]);
            const parsed = csvToPlayers(csv);
            
            expect(parsed[0].name).toBe('Éloïse François');
        });

        it('should handle very large ELO values', () => {
            const player: Player = {
                id: 'p6',
                name: 'Grandmaster',
                elo: 9999,
                wins: 1000,
                losses: 0,
                draws: 0,
                previousRank: 1,
                currentStreakType: 'W',
                currentStreakLength: 1000
            };
            
            const csv = playersToCSV([player]);
            const parsed = csvToPlayers(csv);
            
            expect(parsed[0].elo).toBe(9999);
            expect(parsed[0].wins).toBe(1000);
            expect(parsed[0].currentStreakLength).toBe(1000);
        });

        it('should handle empty players array', () => {
            const csv = playersToCSV([]);
            expect(csv).toContain('id,name,elo'); // Should still have headers
            
            const parsed = csvToPlayers(csv);
            expect(parsed).toEqual([]);
        });

        it('should handle empty matches array', () => {
            const csv = matchesToCSV([]);
            expect(csv).toContain('id,timestamp'); // Should still have headers
            
            const parsed = csvToMatches(csv);
            expect(parsed).toEqual([]);
        });
    });
});
