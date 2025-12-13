import { store } from '../state/store';
import { Match, Player } from '../types/appTypes';
import { INITIAL_ELO } from '../constants/appConstants';
import { calculateElo } from '../utils/eloCalculator';
import { deduceKFromFirstMatch } from '../utils/importUtils';
import { escapeCsvValue, downloadFile } from '../utils/csvUtils';
import { calculatePlayerStreaks } from '../utils/statsUtils';
import { generateUUID } from '../utils/uuid'; // Assuming we export this or need to move it too. ORIGINAL index.tsx has it. 
// Note: generateUUID was in index.tsx. I should move it to utils/uuid.ts first or duplicate/import.
// I will assume I move it to utils/uuid.ts as well.

// Callbacks interface
interface HandlerContext {
    render: () => void;
    updateKFactorInputState: () => void;
    DOMElements: any; // Using any for simplicity as AppDOMElements is in index.tsx or domElements.ts? It's in utils/domElements.ts
}

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

export function handleExportMatches() {
    const { matchHistory } = store;
    if (matchHistory.length === 0) {
        alert('No match history to export.');
        return;
    }

    const headers = ['Timestamp', 'Player 1', 'Player 2', 'Outcome', 'P1 ELO Before', 'P1 ELO After', 'P2 ELO Before', 'P2 ELO After'];
    const csvRows = [headers.join(',')];

    matchHistory.forEach(match => {
        let outcomeText = 'Draw';
        if (match.outcome === 'p1') outcomeText = `${match.player1Name} Won`;
        if (match.outcome === 'p2') outcomeText = `${match.player2Name} Won`;

        const row = [
            escapeCsvValue(new Date(match.timestamp).toISOString()),
            escapeCsvValue(match.player1Name),
            escapeCsvValue(match.player2Name),
            escapeCsvValue(outcomeText),
            match.player1EloBefore,
            match.player1EloAfter,
            match.player2EloBefore,
            match.player2EloAfter,
        ].join(',');
        csvRows.push(row);
    });

    downloadFile(csvRows.join('\n'), 'game-of-stick-matches.csv', 'text/csv;charset=utf-8;');
}

export function createImportMatchesHandler(context: StrictHandlerContext) {
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
            if (lines.length <= 1) { // Header + potentially empty data
                alert('CSV file is empty or only contains headers.');
                return;
            }

            // Deduce K from first match
            const firstParts = lines[1].split(',');
            let detectedK = deduceKFromFirstMatch(firstParts);
            if (detectedK && detectedK > 0) {
                store.setKFactor(detectedK);
                if (context.DOMElements.kFactorInput) context.DOMElements.kFactorInput.value = String(store.kFactor);
                alert(`K détecté automatiquement à l'import : K = ${store.kFactor}`);
            }

            const importedMatches: Match[] = [];

            // Working on a copy of players to avoid partial state updates if error
            // But logic uses IDs, so we need to reference current store.players
            // We'll modify store.players in place as intended by the original script
            const { players } = store;
            const existingPlayerNames = new Set(players.map(p => p.name.toLowerCase()));

            for (let i = 1; i < lines.length; i++) { // Start from 1 to skip header
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(',');
                if (parts.length < 3) {
                    console.warn(`Skipping malformed row: ${line}`);
                    continue;
                }

                const player1Name = parts[1].trim();
                const player2Name = parts[2].trim();
                const outcomeTextRaw = parts[3].trim();

                let outcome: 'p1' | 'p2' | 'draw';
                if (outcomeTextRaw.includes(player1Name) && outcomeTextRaw.includes('Won')) outcome = 'p1';
                else if (outcomeTextRaw.includes(player2Name) && outcomeTextRaw.includes('Won')) outcome = 'p2';
                else if (outcomeTextRaw === 'Draw') outcome = 'draw';
                else {
                    console.warn(`Skipping row with unparseable outcome text '${outcomeTextRaw}': ${line}`);
                    continue;
                }

                // Find or create player1
                let player1 = players.find(p => p.name.toLowerCase() === player1Name.toLowerCase());
                if (!player1) {
                    player1 = {
                        id: generateUUID(),
                        name: player1Name,
                        elo: INITIAL_ELO,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        previousRank: 0,
                        currentStreakType: null,
                        currentStreakLength: 0,
                    };
                    players.push(player1);
                    existingPlayerNames.add(player1Name.toLowerCase());
                }

                // Find or create player2
                let player2 = players.find(p => p.name.toLowerCase() === player2Name.toLowerCase());
                if (!player2) {
                    player2 = {
                        id: generateUUID(),
                        name: player2Name,
                        elo: INITIAL_ELO,
                        wins: 0,
                        losses: 0,
                        draws: 0,
                        previousRank: 0,
                        currentStreakType: null,
                        currentStreakLength: 0,
                    };
                    players.push(player2);
                    existingPlayerNames.add(player2Name.toLowerCase());
                }

                if (player1.id === player2.id) {
                    console.warn(`Skipping match: Player 1 and Player 2 are the same in row: ${line}`);
                    continue;
                }

                const p1EloBeforeMatch = player1.elo;
                const p2EloBeforeMatch = player2.elo;

                const { newP1Elo, newP2Elo } = calculateElo(player1.elo, player2.elo, outcome, store.kFactor);

                const newMatch: Match = {
                    id: generateUUID(),
                    timestamp: (() => {
                        const iso = parts[0]?.trim();
                        const parsed = iso ? Date.parse(iso) : NaN;
                        return isNaN(parsed) ? Date.now() : parsed;
                    })(),
                    player1Id: player1.id,
                    player2Id: player2.id,
                    player1Name: player1.name,
                    player2Name: player2.name,
                    player1EloBefore: p1EloBeforeMatch,
                    player2EloBefore: p2EloBeforeMatch,
                    player1EloAfter: newP1Elo,
                    player2EloAfter: newP2Elo,
                    outcome: outcome,
                    player1EloChange: newP1Elo - p1EloBeforeMatch,
                    player2EloChange: newP2Elo - p2EloBeforeMatch,
                };
                importedMatches.push(newMatch);

                player1.elo = newP1Elo;
                player2.elo = newP2Elo;

                if (outcome === 'p1') {
                    player1.wins++;
                    player2.losses++;
                } else if (outcome === 'p2') {
                    player1.losses++;
                    player2.wins++;
                } else { // Draw
                    player1.draws++;
                    player2.draws++;
                }
            }

            store.matchHistory.push(...importedMatches);

            // Recalculate ranks
            const sortedPlayersAfterImport = [...players].sort((a, b) => b.elo - a.elo);
            players.forEach(p => {
                const sortedIndex = sortedPlayersAfterImport.findIndex(sp => sp.id === p.id);
                if (sortedIndex !== -1) {
                    p.previousRank = sortedIndex + 1;
                }
            });

            calculatePlayerStreaks(players, store.matchHistory);

            context.updateKFactorInputState();
            context.render();
            alert(`Successfully imported ${importedMatches.length} matches.`);
        };

        reader.onerror = () => {
            alert('Error reading file.');
        };

        reader.readAsText(file);
        input.value = '';
    };
}

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
