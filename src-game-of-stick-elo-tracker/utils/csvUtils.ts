/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';

export function escapeCsvValue(value: any): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function unescapeCsvValue(value: string): string {
    if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/""/g, '"');
    }
    return value;
}

export function parseCSV(content: string): string[][] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return []; // Header only or empty

    const data: string[][] = [];

    // Skip header (index 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '"') {
                if (inQuotes && line[j + 1] === '"') {
                    current += '"';
                    j++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current);
        data.push(row);
    }
    return data;
}

export function playersToCSV(players: Player[]): string {
    const headers = ['id', 'name', 'elo', 'wins', 'losses', 'draws', 'previousRank', 'currentStreakType', 'currentStreakLength'].join(',');
    const rows = players.map(p => {
        return [
            escapeCsvValue(p.id),
            escapeCsvValue(p.name),
            p.elo,
            p.wins,
            p.losses,
            p.draws,
            p.previousRank,
            escapeCsvValue(p.currentStreakType),
            p.currentStreakLength
        ].join(',');
    });
    return [headers, ...rows].join('\n');
}

export function csvToPlayers(csv: string): Player[] {
    const rows = parseCSV(csv);
    return rows.map(row => ({
        id: row[0],
        name: row[1],
        elo: parseInt(row[2]) || 1200,
        wins: parseInt(row[3]) || 0,
        losses: parseInt(row[4]) || 0,
        draws: parseInt(row[5]) || 0,
        previousRank: parseInt(row[6]) || 0,
        currentStreakType: (row[7] === 'null' || row[7] === '') ? null : row[7] as 'W' | 'L',
        currentStreakLength: parseInt(row[8]) || 0
    }));
}

export function matchesToCSV(matches: Match[]): string {
    const headers = ['id', 'timestamp', 'player1Id', 'player2Id', 'player1Name', 'player2Name', 'player1EloBefore', 'player2EloBefore', 'player1EloAfter', 'player2EloAfter', 'outcome', 'player1EloChange', 'player2EloChange'].join(',');
    const rows = matches.map(m => {
        return [
            escapeCsvValue(m.id),
            m.timestamp,
            escapeCsvValue(m.player1Id),
            escapeCsvValue(m.player2Id),
            escapeCsvValue(m.player1Name),
            escapeCsvValue(m.player2Name),
            m.player1EloBefore,
            m.player2EloBefore,
            m.player1EloAfter,
            m.player2EloAfter,
            escapeCsvValue(m.outcome),
            m.player1EloChange ?? 0,
            m.player2EloChange ?? 0
        ].join(',');
    });
    return [headers, ...rows].join('\n');
}

export function csvToMatches(csv: string): Match[] {
    const rows = parseCSV(csv);
    return rows.map(row => ({
        id: row[0],
        timestamp: parseInt(row[1]) || Date.now(),
        player1Id: row[2],
        player2Id: row[3],
        player1Name: row[4],
        player2Name: row[5],
        player1EloBefore: parseInt(row[6]) || 1200,
        player2EloBefore: parseInt(row[7]) || 1200,
        player1EloAfter: parseInt(row[8]) || 1200,
        player2EloAfter: parseInt(row[9]) || 1200,
        outcome: row[10] as 'p1' | 'p2' | 'draw',
        player1EloChange: parseInt(row[11]) || 0,
        player2EloChange: parseInt(row[12]) || 0
    }));
}

export function downloadFile(content: string, filename: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
