/**
 * PDF Export utility for Game of S.T.I.C.K.
 * Uses print-to-PDF approach for proper Unicode/emoji support
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { eloScoring } from '../scoring';

/**
 * Beautiful color palette for player curves (distinct, vibrant colors)
 */
const PLAYER_COLORS = [
    '#FF6B35', // Vibrant Orange
    '#00D4AA', // Teal
    '#7B68EE', // Medium Slate Blue
    '#FF1493', // Deep Pink
    '#32CD32', // Lime Green
    '#FFD700', // Gold
    '#00BFFF', // Deep Sky Blue
    '#FF4500', // Orange Red
    '#9370DB', // Medium Purple
    '#20B2AA', // Light Sea Green
    '#DC143C', // Crimson
    '#00CED1', // Dark Turquoise
];

/**
 * Generate beautiful multi-player ELO evolution chart
 * Shows all players' ELO progression over time with labeled curves
 */
function generateAllPlayersEloChart(players: Player[], matchHistory: Match[]): string {
    if (matchHistory.length === 0 || players.length === 0) {
        return '';
    }

    // Sort matches by timestamp
    const sortedMatches = [...matchHistory].sort((a, b) => a.timestamp - b.timestamp);

    // Build ELO history for each player
    const initialElo = eloScoring.getInitialRating();
    const playerHistories: Map<string, { name: string; color: string; eloPoints: number[] }> = new Map();

    // Initialize all players at their starting ELO
    const playerElos: Map<string, number> = new Map();
    players.forEach((player, index) => {
        playerElos.set(player.id, initialElo);
        playerHistories.set(player.id, {
            name: player.name,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            eloPoints: [initialElo]
        });
    });

    // Process each match and update ELO history
    sortedMatches.forEach(match => {
        // Update the two players involved
        if (playerElos.has(match.player1Id)) {
            playerElos.set(match.player1Id, match.player1EloAfter);
        }
        if (playerElos.has(match.player2Id)) {
            playerElos.set(match.player2Id, match.player2EloAfter);
        }

        // Record current state for all players
        players.forEach(player => {
            const history = playerHistories.get(player.id);
            if (history) {
                history.eloPoints.push(playerElos.get(player.id) || initialElo);
            }
        });
    });

    // SVG dimensions
    const svgWidth = 700;
    const svgHeight = 400;
    const padding = { top: 40, right: 140, bottom: 60, left: 60 };
    const graphWidth = svgWidth - padding.left - padding.right;
    const graphHeight = svgHeight - padding.top - padding.bottom;

    // Calculate min/max ELO across all players for Y-axis
    let minElo = initialElo;
    let maxElo = initialElo;
    playerHistories.forEach(history => {
        minElo = Math.min(minElo, ...history.eloPoints);
        maxElo = Math.max(maxElo, ...history.eloPoints);
    });
    const eloMargin = Math.max(50, (maxElo - minElo) * 0.1);
    minElo = Math.floor((minElo - eloMargin) / 50) * 50;
    maxElo = Math.ceil((maxElo + eloMargin) / 50) * 50;
    const eloRange = maxElo - minElo || 100;

    const numPoints = sortedMatches.length + 1;

    // Helper functions
    const xScale = (index: number) => padding.left + (index / (numPoints - 1)) * graphWidth;
    const yScale = (elo: number) => padding.top + graphHeight - ((elo - minElo) / eloRange) * graphHeight;

    // Build SVG
    let svg = `
    <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <defs>
            <!-- Gradient background -->
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
            </linearGradient>
            <!-- Glow filter for lines -->
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Background -->
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#bgGradient)" rx="12"/>

        <!-- Title -->
        <text x="${svgWidth / 2}" y="28" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff">📈 ELO EVOLUTION</text>

        <!-- Horizontal grid lines -->
`;

    // Add horizontal grid lines
    const numGridLines = 5;
    for (let i = 0; i <= numGridLines; i++) {
        const elo = minElo + (eloRange / numGridLines) * i;
        const y = yScale(elo);
        svg += `        <line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(255,255,255,0.5)">${Math.round(elo)}</text>
`;
    }

    // Add vertical grid lines (for each match)
    const maxVerticalLines = Math.min(numPoints, 20);
    const step = Math.max(1, Math.floor(numPoints / maxVerticalLines));
    for (let i = 0; i < numPoints; i += step) {
        const x = xScale(i);
        svg += `        <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + graphHeight}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
`;
    }

    // X-axis label
    svg += `        <text x="${padding.left + graphWidth / 2}" y="${svgHeight - 15}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.6)">Matches (${sortedMatches.length} total)</text>
`;

    // Y-axis label
    svg += `        <text x="15" y="${padding.top + graphHeight / 2}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.6)" transform="rotate(-90 15 ${padding.top + graphHeight / 2})">ELO Rating</text>
`;

    // Draw player curves (sorted by final ELO for proper layering)
    const playerArray = Array.from(playerHistories.values())
        .sort((a, b) => b.eloPoints[b.eloPoints.length - 1] - a.eloPoints[a.eloPoints.length - 1]);

    playerArray.forEach(playerData => {
        const points = playerData.eloPoints.map((elo, i) => `${xScale(i).toFixed(1)},${yScale(elo).toFixed(1)}`).join(' L ');

        // Add area fill under curve
        const lastX = xScale(playerData.eloPoints.length - 1);
        const firstX = xScale(0);
        const areaPath = `M ${xScale(0)},${yScale(playerData.eloPoints[0])} L ${points} L ${lastX},${yScale(minElo)} L ${firstX},${yScale(minElo)} Z`;
        svg += `        <path d="${areaPath}" fill="${playerData.color}" fill-opacity="0.08"/>
`;

        // Draw the line
        svg += `        <path d="M ${points}" stroke="${playerData.color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
`;

        // Draw endpoint dot
        const lastElo = playerData.eloPoints[playerData.eloPoints.length - 1];
        const endX = xScale(playerData.eloPoints.length - 1);
        const endY = yScale(lastElo);
        svg += `        <circle cx="${endX}" cy="${endY}" r="5" fill="${playerData.color}" stroke="#fff" stroke-width="1.5"/>
`;
    });

    // Draw legend on the right side
    svg += `
        <!-- Legend -->
`;
    playerArray.forEach((playerData, i) => {
        const lastElo = playerData.eloPoints[playerData.eloPoints.length - 1];
        const yPos = padding.top + 10 + i * 22;
        const truncatedName = playerData.name.length > 10 ? playerData.name.substring(0, 10) + '…' : playerData.name;

        svg += `        <rect x="${padding.left + graphWidth + 10}" y="${yPos - 8}" width="12" height="12" rx="2" fill="${playerData.color}"/>
        <text x="${padding.left + graphWidth + 28}" y="${yPos + 2}" font-size="11" fill="#fff" font-weight="500">${truncatedName}</text>
        <text x="${padding.left + graphWidth + 115}" y="${yPos + 2}" font-size="10" fill="rgba(255,255,255,0.6)" text-anchor="end">${lastElo}</text>
`;
    });

    svg += `    </svg>`;

    return svg;
}

/**
 * Generate SVG graph for ELO evolution (single player)
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

    // Use date of last match instead of current date
    const lastMatchTimestamp = matchHistory.length > 0
        ? Math.max(...matchHistory.map(m => m.timestamp))
        : Date.now();
    const dateStr = new Date(lastMatchTimestamp).toLocaleDateString('en-GB', {
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
            page-break-before: always;
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 15px; 
            margin-bottom: 15px;
        }
        .player-card:first-of-type {
            page-break-before: auto;
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

    // ELO Evolution Chart - Full page visualization
    const evolutionChart = generateAllPlayersEloChart(sortedPlayers, matchHistory);
    if (evolutionChart) {
        html += `
        <div class="section" style="page-break-before: always; text-align: center;">
            <h2>📈 ELO EVOLUTION OVER TIME</h2>
            <p style="color: #666; margin-bottom: 20px;">Track how each player's rating changed throughout the tournament</p>
            ${evolutionChart}
        </div>
        `;
    }

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

        // All battles for this player
        const playerMatches = matchHistory
            .filter(m => m.player1Id === player.id || m.player2Id === player.id)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (playerMatches.length > 0) {
            html += '<div class="battles"><h4>All Battles</h4>';

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
