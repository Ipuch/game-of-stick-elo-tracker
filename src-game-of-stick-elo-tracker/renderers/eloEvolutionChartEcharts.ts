/**
 * Game of STICK - ELO Tracker
 * ECharts Interactive Full-Screen ELO Evolution Chart
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import type { ECharts, EChartsOption } from 'echarts';
import { Player, Match } from '../types/appTypes';
import { eloScoring } from '../scoring';
import { ChartData, PLAYER_COLORS } from '../utils/chartUtils';

let chartInstance: ECharts | null = null;
let modalElement: HTMLDivElement | null = null;

/**
 * Build ELO history data for all players
 */
function buildEloHistoryData(players: Player[], matchHistory: Match[]) {
    const sortedMatches = [...matchHistory].sort((a, b) => a.timestamp - b.timestamp);
    const initialElo = eloScoring.getInitialRating();

    const playerHistories: Map<string, { name: string; color: string; data: number[] }> = new Map();
    const playerElos: Map<string, number> = new Map();

    // Initialize all players
    players.forEach((player, index) => {
        playerElos.set(player.id, initialElo);
        playerHistories.set(player.id, {
            name: player.name,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            data: [initialElo]
        });
    });

    // Process each match
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
                history.data.push(playerElos.get(player.id) || initialElo);
            }
        });
    });

    // Create x-axis labels
    const xAxisData = ['Start', ...sortedMatches.map((_, i) => `Match ${i + 1}`)];

    return { playerHistories, xAxisData };
}

/**
 * Process ChartData into the internal history format
 */
function processChartData(chartData: ChartData) {
    const playerHistories: Map<string, { name: string; color: string; data: number[] }> = new Map();

    chartData.players.forEach((p, index) => {
        // Use normalized name or ID as key
        playerHistories.set(p.id || p.name, {
            name: p.name,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            data: p.eloHistory
        });
    });

    return {
        playerHistories,
        xAxisData: chartData.xAxisLabels
    };
}

/**
 * Create and show the fullscreen ECharts modal.
 * Overloaded to support both raw player/match data and pre-computed ChartData.
 */
export async function showFullscreenChart(players: Player[], matchHistory: Match[]): Promise<void>;
export async function showFullscreenChart(chartData: ChartData, title?: string): Promise<void>;
export async function showFullscreenChart(arg1: any, arg2: any): Promise<void> {
    // Check arguments
    let players: Player[] = [];
    let matchHistory: Match[] = [];
    let chartData: ChartData | null = null;
    let title = 'ELO Evolution Chart';

    if (Array.isArray(arg1) && Array.isArray(arg2)) {
        players = arg1;
        matchHistory = arg2;
    } else if (arg1 && typeof arg1 === 'object' && 'players' in arg1 && 'xAxisLabels' in arg1) {
        chartData = arg1;
        if (typeof arg2 === 'string') {
            title = arg2;
        }
    } else {
        console.error('Invalid arguments for showFullscreenChart');
        return;
    }

    if ((!chartData && (matchHistory.length === 0 || players.length === 0)) ||
        (chartData && (chartData.totalMatches === 0 || chartData.players.length === 0))) {
        alert('No match data available to display.');
        return;
    }

    // Dynamic import for ECharts
    let echarts;
    try {
        echarts = await import('echarts');
    } catch (e) {
        console.error('Failed to load chart library', e);
        alert('Could not load styling library. Please check your internet connection.');
        return;
    }

    // Create modal if it doesn't exist
    if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.id = 'echarts-fullscreen-modal';
        modalElement.innerHTML = `
            <div class="echarts-modal-backdrop"></div>
            <div class="echarts-modal-content">
                <div class="echarts-modal-header">
                    <h2 id="echarts-modal-title">📈 ELO Evolution Chart</h2>
                    <div class="echarts-modal-actions">
                        <button id="echarts-reset-zoom" class="echarts-btn">Reset Zoom</button>
                        <button id="echarts-close" class="echarts-btn echarts-btn-close">✕ Close</button>
                    </div>
                </div>
                <div id="echarts-container"></div>
                <div class="echarts-modal-footer">
                    <p>💡 Tip: Click on a player's curve or label to dim/undim them • Scroll to zoom • Drag to pan</p>
                </div>
            </div>
        `;
        document.body.appendChild(modalElement);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #echarts-fullscreen-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .echarts-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(5px);
            }
            .echarts-modal-content {
                position: relative;
                width: 95vw;
                height: 90vh;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 16px;
                border: 1px solid rgba(0, 243, 255, 0.3);
                box-shadow: 0 0 50px rgba(0, 243, 255, 0.2);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .echarts-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .echarts-modal-header h2 {
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-size: 1.5rem;
                margin: 0;
            }
            .echarts-modal-actions {
                display: flex;
                gap: 10px;
            }
            .echarts-btn {
                padding: 8px 16px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .echarts-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.4);
            }
            .echarts-btn-close {
                background: rgba(255, 0, 85, 0.2);
                border-color: rgba(255, 0, 85, 0.4);
            }
            .echarts-btn-close:hover {
                background: rgba(255, 0, 85, 0.4);
            }
            #echarts-container {
                flex: 1;
                width: 100%;
            }
            .echarts-modal-footer {
                padding: 10px 20px;
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            .echarts-modal-footer p {
                color: rgba(255, 255, 255, 0.5);
                font-size: 12px;
                margin: 0;
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        modalElement.querySelector('.echarts-modal-backdrop')?.addEventListener('click', hideFullscreenChart);
        modalElement.querySelector('#echarts-close')?.addEventListener('click', hideFullscreenChart);
        modalElement.querySelector('#echarts-reset-zoom')?.addEventListener('click', () => {
            if (chartInstance) {
                chartInstance.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalElement?.style.display !== 'none') {
                hideFullscreenChart();
            }
        });
    }

    // Update title
    const titleEl = modalElement.querySelector('#echarts-modal-title');
    if (titleEl) {
        titleEl.textContent = title;
    }

    // Show modal
    modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Initialize chart
    const container = document.getElementById('echarts-container');
    if (!container) return;

    if (chartInstance) {
        chartInstance.dispose();
    }

    // Use dynamically imported echarts
    chartInstance = echarts.init(container, 'dark');

    // Build data (either from raw players/matches or pre-computed chartData)
    let processedData;
    if (chartData) {
        processedData = processChartData(chartData);
    } else {
        processedData = buildEloHistoryData(players, matchHistory);
    }

    const { playerHistories, xAxisData } = processedData;

    // Sort by final ELO
    const sortedPlayers = Array.from(playerHistories.values())
        .sort((a, b) => b.data[b.data.length - 1] - a.data[a.data.length - 1]);

    // Track state of dimmed players
    const dimmedPlayers = new Set<string>();

    function updateChart() {
        if (!chartInstance) return;

        // Build series with dimmed state logic
        const series = sortedPlayers.map(playerData => {
            const isDimmed = dimmedPlayers.has(playerData.name);
            const baseColor = isDimmed ? '#444' : playerData.color;
            const zLevel = isDimmed ? 1 : 10;
            const lineWidth = isDimmed ? 2 : 4;
            const opacity = isDimmed ? 0.3 : 1;

            // Format data to style the last point with label
            const data = playerData.data.map((value, index) => {
                if (index === playerData.data.length - 1) {
                    return {
                        value,
                        symbol: 'circle',
                        symbolSize: isDimmed ? 6 : 10,
                        itemStyle: {
                            borderColor: isDimmed ? '#666' : '#fff',
                            borderWidth: isDimmed ? 1 : 3,
                            color: baseColor,
                            opacity: 1 // Keep end dot visible but styled
                        },
                        label: {
                            show: true,
                            position: 'right' as const,
                            color: isDimmed ? '#666' : '#fff',
                            fontWeight: (isDimmed ? 'normal' : 'bold') as any,
                            fontSize: isDimmed ? 12 : 16,
                            formatter: '{a}: {c}',
                            backgroundColor: isDimmed ? 'transparent' : 'rgba(0,0,0,0.6)',
                            padding: [4, 8],
                            borderRadius: 4
                        }
                    };
                }
                return value;
            });

            return {
                name: playerData.name,
                type: 'line' as const,
                data: data,
                smooth: false,
                symbol: 'circle',
                symbolSize: isDimmed ? 4 : 8,
                z: zLevel,
                lineStyle: {
                    width: lineWidth,
                    color: baseColor,
                    opacity: opacity
                },
                itemStyle: {
                    color: baseColor,
                    opacity: opacity
                },
                // Smart label layout to prevent overlaps
                labelLayout: {
                    moveOverlap: 'shiftY' as any
                },
                emphasis: {
                    focus: 'none' as const, // Handle focus manually
                    lineStyle: {
                        width: isDimmed ? 2 : 6
                    }
                }
            };
        });

        // Chart options
        const option: EChartsOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(20, 25, 40, 0.95)',
                borderColor: 'rgba(0, 243, 255, 0.3)',
                textStyle: {
                    color: '#fff',
                    fontSize: 16
                },
                formatter: function (params: any) {
                    if (!Array.isArray(params)) return '';
                    const header = `<div style="margin-bottom:8px;font-weight:bold;font-size:16px">${params[0].axisValue}</div>`;

                    const items = params
                        .sort((a: any, b: any) => b.value - a.value)
                        .map((p: any) => {
                            const val = typeof p.value === 'object' ? p.value.value : p.value;
                            const isDimmed = dimmedPlayers.has(p.seriesName);
                            const seriesIndex = series.findIndex(s => s.name === p.seriesName);
                            let prevVal = 0;
                            if (p.dataIndex > 0 && seriesIndex !== -1) {
                                const prevData = series[seriesIndex].data[p.dataIndex - 1];
                                prevVal = typeof prevData === 'object' ? (prevData as any).value : prevData as number;
                            }

                            const change = p.dataIndex > 0 ? val - prevVal : 0;
                            const changeStr = change !== 0 ?
                                `<span style="color:${change > 0 ? '#4caf50' : '#f44336'}">(${change > 0 ? '+' : ''}${change})</span>` : '';

                            const opacity = isDimmed ? 0.5 : 1;
                            const color = isDimmed ? '#999' : '#fff';

                            return `<div style="display:flex;justify-content:space-between;gap:30px;font-size:15px;margin-bottom:4px;opacity:${opacity};color:${color}">
                                <span>${p.marker} ${p.seriesName}</span>
                                <span><strong>${val}</strong> ${changeStr}</span>
                            </div>`;
                        })
                        .join('');
                    return header + items;
                }
            },
            // Legend REMOVED
            grid: {
                left: 60,
                right: 300, // Ample space for right-aligned labels
                top: 40,
                bottom: 80,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: xAxisData,
                axisLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.4)', width: 2 }
                },
                axisLabel: {
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 14,
                    rotate: xAxisData.length > 20 ? 45 : 0,
                    margin: 16
                }
            },
            yAxis: {
                type: 'value',
                min: (value) => Math.floor(value.min - 50),
                name: 'ELO Rating',
                nameTextStyle: {
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 16,
                    padding: [0, 0, 10, 0]
                },
                axisLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.4)', width: 2 }
                },
                axisLabel: {
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 14,
                    margin: 16
                },
                splitLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    bottom: 30,
                    height: 30,
                    textStyle: {
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 14
                    }
                }
            ],
            series
        };

        chartInstance.setOption(option);
    }

    // Initial render
    updateChart();

    // Click handler for interaction
    chartInstance.on('click', (params) => {
        // Toggle dim state on series click
        if (params.componentType === 'series') {
            const name = params.seriesName;
            if (name) {
                if (dimmedPlayers.has(name)) {
                    dimmedPlayers.delete(name);
                } else {
                    dimmedPlayers.add(name);
                }
                updateChart();
            }
        }
    });

    // Handle resize
    window.addEventListener('resize', () => {
        chartInstance?.resize();
    });
}

/**
 * Hide the fullscreen chart modal
 */
export function hideFullscreenChart() {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
    if (chartInstance) {
        chartInstance.dispose();
        chartInstance = null;
    }
}
