/**
 * Game of S.T.I.C.K. - ELO Tracker
 * ELO Evolution Chart Renderer for Web View
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { eloScoring } from '../scoring';
import { showFullscreenChart } from './eloEvolutionChartEcharts';

// Store data for fullscreen button callback
let cachedPlayers: Player[] = [];
let cachedMatchHistory: Match[] = [];

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
 * Render the ELO evolution chart in the Stats view
 */
export function renderEloEvolutionChart(players: Player[], matchHistory: Match[]) {
    const container = document.getElementById('elo-evolution-chart');
    if (!container) return;

    // Cache data for fullscreen button
    cachedPlayers = players;
    cachedMatchHistory = matchHistory;

    if (matchHistory.length === 0 || players.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">No match data available. Record some matches to see the evolution chart!</p>';
        return;
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
        if (playerElos.has(match.player1Id)) {
            playerElos.set(match.player1Id, match.player1EloAfter);
        }
        if (playerElos.has(match.player2Id)) {
            playerElos.set(match.player2Id, match.player2EloAfter);
        }

        players.forEach(player => {
            const history = playerHistories.get(player.id);
            if (history) {
                history.eloPoints.push(playerElos.get(player.id) || initialElo);
            }
        });
    });

    // SVG dimensions - responsive
    const svgWidth = 800;
    const svgHeight = 450;
    const padding = { top: 50, right: 160, bottom: 70, left: 70 };
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
    const xScale = (index: number) => padding.left + (index / Math.max(numPoints - 1, 1)) * graphWidth;
    const yScale = (elo: number) => padding.top + graphHeight - ((elo - minElo) / eloRange) * graphHeight;

    // Build SVG
    let svg = `
    <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif; border-radius: 16px; overflow: visible;">
        <defs>
            <!-- Gradient background -->
            <linearGradient id="bgGradientWeb" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
            </linearGradient>
            <!-- Glow filter for lines -->
            <filter id="glowWeb" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <!-- Drop shadow for container -->
            <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
            </filter>
        </defs>

        <!-- Background with shadow -->
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#bgGradientWeb)" rx="16" filter="url(#dropShadow)"/>
`;

    // Draw horizontal grid lines
    const numGridLines = 6;
    for (let i = 0; i <= numGridLines; i++) {
        const elo = minElo + (eloRange / numGridLines) * i;
        const y = yScale(elo);
        svg += `        <line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="rgba(255,255,255,0.5)">${Math.round(elo)}</text>
`;
    }

    // Draw vertical grid lines
    const maxVerticalLines = Math.min(numPoints, 15);
    const step = Math.max(1, Math.floor(numPoints / maxVerticalLines));
    for (let i = 0; i < numPoints; i += step) {
        const x = xScale(i);
        svg += `        <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + graphHeight}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
`;
    }

    // X-axis label
    svg += `        <text x="${padding.left + graphWidth / 2}" y="${svgHeight - 20}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.6)">Matches (${sortedMatches.length} total)</text>
`;

    // Y-axis label
    svg += `        <text x="20" y="${padding.top + graphHeight / 2}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.6)" transform="rotate(-90 20 ${padding.top + graphHeight / 2})">ELO Rating</text>
`;

    // Sort players by final ELO for proper layering
    const playerArray = Array.from(playerHistories.values())
        .sort((a, b) => b.eloPoints[b.eloPoints.length - 1] - a.eloPoints[a.eloPoints.length - 1]);

    // Draw player curves
    playerArray.forEach(playerData => {
        const points = playerData.eloPoints.map((elo, i) => `${xScale(i).toFixed(1)},${yScale(elo).toFixed(1)}`).join(' L ');

        // Area fill under curve
        const lastX = xScale(playerData.eloPoints.length - 1);
        const firstX = xScale(0);
        const areaPath = `M ${xScale(0)},${yScale(playerData.eloPoints[0])} L ${points} L ${lastX},${yScale(minElo)} L ${firstX},${yScale(minElo)} Z`;
        svg += `        <path d="${areaPath}" fill="${playerData.color}" fill-opacity="0.1"/>
`;

        // The line with glow
        svg += `        <path d="M ${points}" stroke="${playerData.color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowWeb)"/>
`;

        // Endpoint dot with nice hover effect
        const lastElo = playerData.eloPoints[playerData.eloPoints.length - 1];
        const endX = xScale(playerData.eloPoints.length - 1);
        const endY = yScale(lastElo);
        svg += `        <circle cx="${endX}" cy="${endY}" r="6" fill="${playerData.color}" stroke="#fff" stroke-width="2">
            <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite"/>
        </circle>
`;
    });

    // Draw legend on the right side
    svg += `
        <!-- Legend -->
`;
    playerArray.forEach((playerData, i) => {
        const lastElo = playerData.eloPoints[playerData.eloPoints.length - 1];
        const firstElo = playerData.eloPoints[0];
        const change = lastElo - firstElo;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        const changeColor = change >= 0 ? '#4caf50' : '#f44336';
        const yPos = padding.top + 20 + i * 28;
        const truncatedName = playerData.name.length > 10 ? playerData.name.substring(0, 10) + '…' : playerData.name;

        svg += `        <rect x="${padding.left + graphWidth + 15}" y="${yPos - 10}" width="16" height="16" rx="3" fill="${playerData.color}"/>
        <text x="${padding.left + graphWidth + 38}" y="${yPos + 3}" font-size="12" fill="#fff" font-weight="600">${truncatedName}</text>
        <text x="${padding.left + graphWidth + 120}" y="${yPos + 3}" font-size="11" fill="rgba(255,255,255,0.7)">${lastElo}</text>
        <text x="${padding.left + graphWidth + 145}" y="${yPos + 3}" font-size="10" fill="${changeColor}">${changeStr}</text>
`;
    });

    svg += `    </svg>`;

    // Create wrapper with button
    container.innerHTML = '';

    // Add wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'elo-chart-wrapper';
    wrapper.style.position = 'relative';
    wrapper.innerHTML = svg;

    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'elo-fullscreen-btn';
    fullscreenBtn.className = 'elo-fullscreen-btn';
    fullscreenBtn.title = 'Open interactive fullscreen chart';
    fullscreenBtn.innerHTML = '⛶ Set Full Screen';
    fullscreenBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 8px 14px;
        background: rgba(0, 243, 255, 0.15);
        border: 1px solid rgba(0, 243, 255, 0.4);
        color: #00f3ff;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
        z-index: 10;
    `;
    fullscreenBtn.onmouseenter = () => {
        fullscreenBtn.style.background = 'rgba(0, 243, 255, 0.25)';
        fullscreenBtn.style.borderColor = '#00f3ff';
        fullscreenBtn.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.3)';
    };
    fullscreenBtn.onmouseleave = () => {
        fullscreenBtn.style.background = 'rgba(0, 243, 255, 0.15)';
        fullscreenBtn.style.borderColor = 'rgba(0, 243, 255, 0.4)';
        fullscreenBtn.style.boxShadow = 'none';
    };
    fullscreenBtn.onclick = () => showFullscreenChart(cachedPlayers, cachedMatchHistory);

    wrapper.appendChild(fullscreenBtn);
    container.appendChild(wrapper);
}
