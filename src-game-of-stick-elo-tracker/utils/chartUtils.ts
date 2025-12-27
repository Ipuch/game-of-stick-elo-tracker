/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Shared ELO Chart Utilities
 * Common types and builders for ELO evolution charts
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { eloScoring } from '../scoring';

/**
 * Beautiful color palette for player curves (distinct, vibrant colors)
 */
export const PLAYER_COLORS = [
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
    '#FF69B4', // Hot Pink
    '#00FF7F', // Spring Green
    '#BA55D3', // Medium Orchid
    '#FF8C00', // Dark Orange
    '#48D1CC', // Medium Turquoise
    '#C71585', // Medium Violet Red
    '#7FFF00', // Chartreuse
    '#4169E1', // Royal Blue
];

/**
 * Common interface for chart player data
 * This abstracts away the difference between Player and AggregatedPlayer
 */
export interface ChartPlayerData {
    id: string;          // Unique identifier (player ID or normalized name)
    name: string;        // Display name
    finalElo: number;    // Current/final ELO rating
    eloHistory: number[]; // Full ELO history for all points
}

/**
 * Chart data ready for rendering
 */
export interface ChartData {
    players: ChartPlayerData[];
    xAxisLabels: string[];
    totalMatches: number;
}

/**
 * Match data needed for chart building
 */
export interface ChartMatch {
    timestamp: number;
    player1Key: string;    // ID or normalized name
    player2Key: string;    // ID or normalized name
    player1EloAfter: number;
    player2EloAfter: number;
}

/**
 * Player info needed for chart initialization
 */
export interface ChartPlayer {
    key: string;           // ID or normalized name
    name: string;          // Display name
    currentElo: number;    // Current ELO
}

/**
 * Build chart data from players and matches
 * Works for both single-game (Player[]) and aggregated (AggregatedPlayer[]) data
 * 
 * @param players - Array of players with key, name, and currentElo
 * @param matches - Array of matches with player keys and ELO changes
 * @param initialElo - Starting ELO (defaults to scoring system's initial rating)
 */
export function buildChartData(
    players: ChartPlayer[],
    matches: ChartMatch[],
    initialElo: number = eloScoring.getInitialRating()
): ChartData {
    // Sort matches chronologically
    const sortedMatches = [...matches].sort((a, b) => a.timestamp - b.timestamp);

    // Initialize player ELO tracking
    const playerElos = new Map<string, number>();
    const playerHistories = new Map<string, number[]>();

    players.forEach(p => {
        playerElos.set(p.key, initialElo);
        playerHistories.set(p.key, [initialElo]);
    });

    // Process each match - update ELO for participants, keep flat for non-participants
    sortedMatches.forEach(match => {
        // Update ELO for match participants
        if (playerElos.has(match.player1Key)) {
            playerElos.set(match.player1Key, match.player1EloAfter);
        }
        if (playerElos.has(match.player2Key)) {
            playerElos.set(match.player2Key, match.player2EloAfter);
        }

        // Record current ELO for ALL players (flat line for non-participants)
        players.forEach(p => {
            const history = playerHistories.get(p.key);
            if (history) {
                history.push(playerElos.get(p.key) || initialElo);
            }
        });
    });

    // Build chart player data sorted by final ELO
    const chartPlayers: ChartPlayerData[] = players
        .map(p => ({
            id: p.key,
            name: p.name,
            finalElo: playerElos.get(p.key) || initialElo,
            eloHistory: playerHistories.get(p.key) || [initialElo]
        }))
        .sort((a, b) => b.finalElo - a.finalElo);

    // Assign colors based on ranking
    chartPlayers.forEach((p, i) => {
        (p as any).color = PLAYER_COLORS[i % PLAYER_COLORS.length];
    });

    // X-axis labels
    const xAxisLabels = ['Start', ...sortedMatches.map((_, i) => `Match ${i + 1}`)];

    return {
        players: chartPlayers,
        xAxisLabels,
        totalMatches: sortedMatches.length
    };
}

/**
 * Get color for a player by their ranking index
 */
export function getPlayerColor(rankIndex: number): string {
    return PLAYER_COLORS[rankIndex % PLAYER_COLORS.length];
}

/**
 * Build ECharts series configuration from chart data
 */
export function buildEchartsSeries(chartData: ChartData) {
    return chartData.players.map((player, idx) => {
        const color = getPlayerColor(idx);

        const data = player.eloHistory.map((value, index) => {
            if (index === player.eloHistory.length - 1) {
                // Style the last point specially
                return {
                    value,
                    symbol: 'circle',
                    symbolSize: 10,
                    itemStyle: { borderColor: '#fff', borderWidth: 3, color },
                    label: {
                        show: true,
                        position: 'right' as const,
                        color: '#fff',
                        fontWeight: 'bold' as const,
                        fontSize: 16,
                        formatter: `{a}: ${value}`,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: [4, 8],
                        borderRadius: 4
                    }
                };
            }
            return value;
        });

        return {
            name: player.name,
            type: 'line' as const,
            data,
            smooth: false,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 3, color },
            itemStyle: { color },
            emphasis: { focus: 'series' as const, lineStyle: { width: 5 } }
        };
    });
}

/**
 * Build standard ECharts options for ELO chart
 */
export function buildEchartsOptions(chartData: ChartData, title?: string) {
    const series = buildEchartsSeries(chartData);

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(20, 25, 40, 0.95)',
            borderColor: 'rgba(0, 243, 255, 0.3)',
            textStyle: { color: '#fff', fontSize: 14 }
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 20,
            top: title ? 80 : 60,
            bottom: 80,
            itemWidth: 20,
            itemHeight: 20,
            itemGap: 15,
            textStyle: { color: '#fff', fontSize: 14 },
            pageIconColor: '#00f3ff',
            pageIconInactiveColor: '#555'
        },
        grid: {
            left: 80,
            right: 220,
            top: title ? 60 : 40,
            bottom: 100,
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: chartData.xAxisLabels,
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.4)' } },
            axisLabel: {
                color: 'rgba(255,255,255,0.8)',
                fontSize: 12,
                rotate: chartData.xAxisLabels.length > 20 ? 45 : 0
            }
        },
        yAxis: {
            type: 'value',
            min: (value: any) => Math.floor(value.min - 50),
            name: 'ELO Rating',
            nameTextStyle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.4)' } },
            axisLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', bottom: 30, height: 25, textStyle: { color: 'rgba(255,255,255,0.8)' } }
        ],
        series
    };
}

/**
 * Generate SVG chart (for inline/thumbnail display)
 */
export function generateSvgChart(
    chartData: ChartData,
    width: number = 800,
    height: number = 400,
    showLabel: boolean = true
): string {
    if (chartData.totalMatches === 0 || chartData.players.length === 0) {
        return '<p style="color: #888; text-align: center; padding: 40px;">No match data available.</p>';
    }

    const padding = { top: 40, right: 150, bottom: 50, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Calculate ELO range
    let minElo = 1200, maxElo = 1200;
    chartData.players.forEach(p => {
        p.eloHistory.forEach(elo => {
            minElo = Math.min(minElo, elo);
            maxElo = Math.max(maxElo, elo);
        });
    });
    const eloMargin = Math.max(50, (maxElo - minElo) * 0.1);
    minElo = Math.floor((minElo - eloMargin) / 50) * 50;
    maxElo = Math.ceil((maxElo + eloMargin) / 50) * 50;
    const eloRange = maxElo - minElo || 100;

    const numPoints = chartData.xAxisLabels.length;
    const xScale = (index: number) => padding.left + (index / Math.max(numPoints - 1, 1)) * graphWidth;
    const yScale = (elo: number) => padding.top + graphHeight - ((elo - minElo) / eloRange) * graphHeight;

    let svg = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px;">
        <defs>
            <linearGradient id="chartBgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
            </linearGradient>
            <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#chartBgGradient)" rx="12"/>
    `;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
        const elo = minElo + (eloRange / 5) * i;
        const y = yScale(elo);
        svg += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
        svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(255,255,255,0.5)">${Math.round(elo)}</text>`;
    }

    // Axis label
    if (showLabel) {
        svg += `<text x="${padding.left + graphWidth / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.6)">Matches (${chartData.totalMatches} total)</text>`;
    }

    // Draw player curves
    chartData.players.forEach((player, idx) => {
        const color = getPlayerColor(idx);
        const points = player.eloHistory.map((elo, i) => `${xScale(i).toFixed(1)},${yScale(elo).toFixed(1)}`).join(' L ');

        // Area under curve
        const lastX = xScale(player.eloHistory.length - 1);
        const firstX = xScale(0);
        const areaPath = `M ${xScale(0)},${yScale(player.eloHistory[0])} L ${points} L ${lastX},${yScale(minElo)} L ${firstX},${yScale(minElo)} Z`;
        svg += `<path d="${areaPath}" fill="${color}" fill-opacity="0.1"/>`;

        // Line
        svg += `<path d="M ${points}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" filter="url(#chartGlow)"/>`;

        // Endpoint
        const lastElo = player.eloHistory[player.eloHistory.length - 1];
        svg += `<circle cx="${lastX}" cy="${yScale(lastElo)}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
    });

    // Legend (top 10)
    chartData.players.slice(0, 10).forEach((player, i) => {
        const color = getPlayerColor(i);
        const yPos = padding.top + 15 + i * 22;
        const truncName = player.name.length > 10 ? player.name.substring(0, 10) + '…' : player.name;
        svg += `<rect x="${padding.left + graphWidth + 15}" y="${yPos - 8}" width="12" height="12" rx="2" fill="${color}"/>`;
        svg += `<text x="${padding.left + graphWidth + 32}" y="${yPos + 2}" font-size="11" fill="#fff">${truncName}</text>`;
        svg += `<text x="${padding.left + graphWidth + 120}" y="${yPos + 2}" font-size="10" fill="rgba(255,255,255,0.6)">${player.finalElo}</text>`;
    });

    svg += '</svg>';
    return svg;
}
