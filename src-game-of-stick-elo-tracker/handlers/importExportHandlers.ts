/**
 * Game of S.T.I.C.K. - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { store } from '../state/store';
import { Player } from '../types/appTypes';
import { INITIAL_ELO } from '../constants/appConstants';
import { escapeCsvValue, downloadFile } from '../utils/csvUtils';
import { calculatePlayerStreaks } from '../utils/statsUtils';
import { generateUUID } from '../utils/uuid'; // Assuming we export this or need to move it too. ORIGINAL index.tsx has it. 
// Note: generateUUID was in index.tsx. I should move it to utils/uuid.ts first or duplicate/import.
// I will assume I move it to utils/uuid.ts as well.

// We need to import AppDOMElements type if we want strict typing
import { AppDOMElements } from '../utils/domElements';

interface StrictHandlerContext {
    render: () => void;
    updateKFactorInputState: () => void;
    DOMElements: AppDOMElements;
}

export function handleExportPlayers() {
    const { players } = store;
    if (players.length === 0) {
        alert('No players to export.');
        return;
    }

    const headers = ['Player Name', 'Initial ELO'];
    const csvRows = [headers.join(',')];

    players.forEach(player => {
        const row = [
            escapeCsvValue(player.name),
            INITIAL_ELO
        ].join(',');
        csvRows.push(row);
    });

    downloadFile(csvRows.join('\n'), 'game-of-stick-players.csv', 'text/csv;charset=utf-8;');
}

// Match export/import handlers removed

export function createImportPlayersHandler(context: StrictHandlerContext) {
    return async function (event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            alert('No file selected.');
            return;
        }

        if (file.type !== 'text/csv') {
            alert('Please upload a CSV file.');
            return;
        }

        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                alert('Failed to read file.');
                return;
            }

            const lines = text.trim().split('\n');
            if (lines.length <= 1) {
                alert('CSV file is empty or only contains headers.');
                return;
            }

            const newPlayers: Player[] = [];
            const { players } = store;
            const existingPlayerNames = new Set(players.map(p => p.name.toLowerCase()));

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(',');
                const playerName = parts[0].trim();
                const initialEloString = parts[1] ? parts[1].trim() : '';
                const initialElo = initialEloString ? parseInt(initialEloString, 10) : INITIAL_ELO;

                if (!playerName) {
                    console.warn(`Skipping row with empty player name: ${line}`);
                    continue;
                }
                if (isNaN(initialElo) || initialElo < 0) {
                    console.warn(`Skipping row with invalid ELO '${initialEloString}': ${line}`);
                    continue;
                }

                if (!existingPlayerNames.has(playerName.toLowerCase())) {
                    newPlayers.push({
                        id: generateUUID(),
                        name: playerName,
                        elo: initialElo,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        previousRank: 0,
                        currentStreakType: null,
                        currentStreakLength: 0,
                        lastEloChange: 0,
                    });
                    existingPlayerNames.add(playerName.toLowerCase());
                } else {
                    console.warn(`Skipping existing player: ${playerName}`);
                }
            }

            if (newPlayers.length > 0) {
                players.push(...newPlayers);
                const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
                players.forEach(p => {
                    const sortedIndex = sortedPlayers.findIndex(sp => sp.id === p.id);
                    if (sortedIndex !== -1) {
                        p.previousRank = sortedIndex + 1;
                    }
                    p.lastEloChange = 0;
                });
                calculatePlayerStreaks(players, store.matchHistory);
                context.render();
                alert(`Successfully imported ${newPlayers.length} new players.`);
            } else {
                alert('No new players to import or all players already exist.');
            }
        };

        reader.onerror = () => {
            alert('Error reading file.');
        };

        reader.readAsText(file);
        input.value = '';
    };
}
