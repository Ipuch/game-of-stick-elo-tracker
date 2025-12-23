/**
 * PDF Export utility for Game of S.T.I.C.K.
 * Uses print-to-PDF approach for proper Unicode/emoji support
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { eloScoring } from '../scoring';

/**
 * Generate SVG graph for ELO evolution
 */
function generateEloGraph(player: Player, matchHistory: Match[]): string {
    const playerMatches = matchHistory
        .filter(m => m.player1Id === player.id || m.player2Id === player.id)
        .sort((a, b) => a.timestamp - b.timestamp);

    let currentElo = eloScoring.getInitialRating();
    const eloHistory = [currentElo];

    playerMatches.forEach(match => {
        const isP1 = match.player1Id === player.id;
        currentElo = isP1 ? match.player1EloAfter : match.player2EloAfter;
        eloHistory.push(currentElo);
    });

    const svgWidth = 180;
    const svgHeight = 50;
    const padding = 5;
    const graphWidth = svgWidth - 2 * padding;
    const graphHeight = svgHeight - 2 * padding;

    if (eloHistory.length <= 1) {
        return `<svg width="${svgWidth}" height="${svgHeight}" style="background:#f8f8f8;border-radius:4px;">
            <line x1="${padding}" y1="${svgHeight / 2}" x2="${svgWidth - padding}" y2="${svgHeight / 2}" stroke="#ccc" stroke-width="1"/>
        </svg>`;
    }

    const minElo = Math.min(...eloHistory);
    const maxElo = Math.max(...eloHistory);
    const eloRange = maxElo - minElo || 1;

    const points = eloHistory.map((elo, index) => {
        const x = padding + (index / (eloHistory.length - 1)) * graphWidth;
        const y = padding + graphHeight - ((elo - minElo) / eloRange) * graphHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const strokeColor = eloHistory[eloHistory.length - 1] >= eloHistory[0] ? '#4caf50' : '#f44336';

    return `<svg width="${svgWidth}" height="${svgHeight}" style="background:#f8f8f8;border-radius:4px;">
        <path d="${pathD}" stroke="${strokeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="${padding}" y="${svgHeight - 2}" font-size="8" fill="#999">${minElo}</text>
        <text x="${svgWidth - padding}" y="${padding + 6}" font-size="8" fill="#999" text-anchor="end">${maxElo}</text>
    </svg>`;
}

/**
 * Generate and trigger print dialog for game stats
 */
export function generateGamePDF(
    players: Player[],
    matchHistory: Match[],
    gameName: string
): void {
    // Sort players by ELO
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

    const dateStr = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // Build HTML content
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${gameName} - Stats</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 20px;
            color: #333;
        }
        .header { 
            text-align: center; 
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #00f3ff;
        }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .header .subtitle { color: #666; font-size: 14px; }
        
        .section { margin-bottom: 25px; }
        .section h2 { 
            font-size: 16px; 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 5px; 
            margin-bottom: 10px;
        }
        
        .podium { display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; }
        .podium-item { text-align: center; }
        .podium-medal { font-size: 32px; }
        .podium-name { font-weight: bold; font-size: 14px; }
        .podium-elo { color: #666; font-size: 12px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f5f5f5; font-weight: 600; }
        
        .player-card { 
            page-break-inside: avoid; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 15px; 
            margin-bottom: 15px;
        }
        .player-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            margin-bottom: 10px;
        }
        .player-name { font-size: 18px; font-weight: bold; }
        .player-rank { color: #00f3ff; font-weight: bold; }
        .player-stats { color: #666; font-size: 12px; margin-bottom: 10px; }
        .player-streak { color: #ff6b35; }
        
        .battles { font-size: 11px; }
        .battles h4 { margin-bottom: 5px; color: #333; }
        .battle-row { 
            padding: 3px 0; 
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            gap: 10px;
        }
        .battle-opponent { width: 100px; }
        .battle-result { width: 50px; font-weight: bold; }
        .battle-result.win { color: #4caf50; }
        .battle-result.loss { color: #f44336; }
        .battle-result.draw { color: #ff9800; }
        .battle-elo { width: 50px; }
        .battle-date { width: 80px; color: #999; }
        .battle-odds { color: #888; }
        .beat-odds { color: #ff6b35; font-weight: bold; }
        
        @media print {
            body { padding: 10px; }
            .player-card { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏆 GAME OF S.T.I.C.K.</h1>
        <div class="subtitle">${gameName} — ${dateStr}</div>
    </div>
`;

    // Podium
    if (sortedPlayers.length >= 1) {
        const medals = ['🥇', '🥈', '🥉'];
        html += '<div class="podium">';
        for (let i = 0; i < Math.min(3, sortedPlayers.length); i++) {
            const p = sortedPlayers[i];
            html += `
                <div class="podium-item">
                    <div class="podium-medal">${medals[i]}</div>
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-elo">${p.elo} ELO</div>
                </div>
            `;
        }
        html += '</div>';
    }

    // Leaderboard
    html += `
        <div class="section">
            <h2>📊 LEADERBOARD</h2>
            <table>
                <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>ELO</th>
                    <th>W</th>
                    <th>L</th>
                    <th>D</th>
                    <th>Total</th>
                    <th>Win%</th>
                </tr>
    `;
    sortedPlayers.forEach((p, i) => {
        const total = p.wins + p.losses + p.draws;
        const winRate = p.wins + p.losses > 0 ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0;
        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${p.elo}</td>
                <td>${p.wins}</td>
                <td>${p.losses}</td>
                <td>${p.draws}</td>
                <td>${total}</td>
                <td>${winRate}%</td>
            </tr>
        `;
    });
    html += '</table></div>';

    // Player Scorecards
    html += '<div class="section"><h2>📋 PLAYER SCORECARDS</h2>';

    sortedPlayers.forEach((player, playerIndex) => {
        const rank = playerIndex + 1;
        const streakStr = getStreakHtml(player);
        const winRate = player.wins + player.losses > 0
            ? Math.round((player.wins / (player.wins + player.losses)) * 100)
            : 0;
        const eloGraph = generateEloGraph(player, matchHistory);

        html += `
            <div class="player-card">
                <div class="player-header">
                    <div>
                        <span class="player-name">${player.name} ${streakStr}</span>
                        <span class="player-rank">#${rank}</span>
                    </div>
                    <div class="elo-graph">${eloGraph}</div>
                </div>
                <div class="player-stats">
                    ELO: <strong>${player.elo}</strong> — 
                    Wins: <strong>${player.wins}</strong> | 
                    Losses: <strong>${player.losses}</strong> | 
                    Draws: <strong>${player.draws}</strong> — 
                    Win Rate: <strong>${winRate}%</strong>
                </div>
        `;

        // Last battles
        const playerMatches = matchHistory
            .filter(m => m.player1Id === player.id || m.player2Id === player.id)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 8);

        if (playerMatches.length > 0) {
            html += '<div class="battles"><h4>Last Battles</h4>';

            playerMatches.forEach(match => {
                const isP1 = match.player1Id === player.id;
                const opponent = isP1 ? match.player2Name : match.player1Name;
                const result = match.outcome === 'draw' ? 'Draw' :
                    (isP1 && match.outcome === 'p1') || (!isP1 && match.outcome === 'p2') ? 'Win' : 'Loss';
                const eloChange = isP1 ? match.player1EloChange : match.player2EloChange;
                const eloStr = (eloChange && eloChange > 0 ? '+' : '') + (eloChange || 0);

                // Odds using centralized scoring
                const expectedScore = eloScoring.getExpectedScore(match.player1EloBefore, match.player2EloBefore);
                const odds = isP1 ? expectedScore : 1 - expectedScore;
                const oddsPercent = Math.round(odds * 100);
                const beatOdds = result === 'Win' && odds < 0.5;

                // Date
                const d = new Date(match.timestamp);
                const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

                html += `
                    <div class="battle-row">
                        <span class="battle-opponent">vs. ${opponent}</span>
                        <span class="battle-result ${result.toLowerCase()}">${result}</span>
                        <span class="battle-elo">(${eloStr})</span>
                        <span class="battle-date">${dateFormatted}</span>
                        <span class="battle-odds">${oddsPercent}%${beatOdds ? ' <span class="beat-odds">Beat the odds!</span>' : ''}</span>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div>';
    });

    html += '</div></body></html>';

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
}

function getStreakHtml(player: Player): string {
    if (player.currentStreakType === 'W' && player.currentStreakLength >= 3) {
        return `<span class="player-streak">🔥 W${player.currentStreakLength}</span>`;
    }
    if (player.currentStreakType === 'L' && player.currentStreakLength >= 3) {
        return `<span class="player-streak">🧊 L${player.currentStreakLength}</span>`;
    }
    return '';
}
