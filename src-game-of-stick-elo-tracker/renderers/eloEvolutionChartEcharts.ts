/**
 * Game of S.T.I.C.K. - ELO Tracker
 * ECharts Interactive Full-Screen ELO Evolution Chart
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import type { ECharts, EChartsOption } from 'echarts';
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
    '#FF69B4', // Hot Pink
    '#00FF7F', // Spring Green
    '#BA55D3', // Medium Orchid
    '#FF8C00', // Dark Orange
    '#48D1CC', // Medium Turquoise
    '#C71585', // Medium Violet Red
    '#7FFF00', // Chartreuse
    '#4169E1', // Royal Blue
];

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
 * Create and show the fullscreen ECharts modal
 */
export async function showFullscreenChart(players: Player[], matchHistory: Match[]) {
    if (matchHistory.length === 0 || players.length === 0) {
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
                    <h2>📈 ELO Evolution Chart</h2>
                    <div class="echarts-modal-actions">
                        <button id="echarts-reset-zoom" class="echarts-btn">Reset Zoom</button>
                        <button id="echarts-close" class="echarts-btn echarts-btn-close">✕ Close</button>
                    </div>
                </div>
                <div id="echarts-container"></div>
                <div class="echarts-modal-footer">
                    <p>💡 Tip: Click legend items to toggle players • Scroll to zoom • Drag to pan</p>
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

    // Build data
    const { playerHistories, xAxisData } = buildEloHistoryData(players, matchHistory);

    // Sort by final ELO for legend ordering
    const sortedPlayers = Array.from(playerHistories.values())
        .sort((a, b) => b.data[b.data.length - 1] - a.data[a.data.length - 1]);

    // Build series
    // Build series
    const series = sortedPlayers.map(playerData => {
        // Format data to style the last point
        const data = playerData.data.map((value, index) => {
            if (index === playerData.data.length - 1) {
                return {
                    value,
                    symbol: 'circle',
                    symbolSize: 10,
                    itemStyle: {
                        borderColor: '#fff',
                        borderWidth: 3,
                        color: playerData.color
                    },
                    label: {
                        show: true,
                        position: 'right' as const,
                        color: '#fff',
                        fontWeight: 'bold' as const,
                        fontSize: 18,
                        formatter: '{a}: {c}',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: [6, 10],
                        borderRadius: 6
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
            symbolSize: 8,
            lineStyle: {
                width: 4,
                color: playerData.color
            },
            itemStyle: {
                color: playerData.color
            },
            emphasis: {
                focus: 'series' as const,
                lineStyle: {
                    width: 6
                }
            }
        };
    });

    // Chart options
    const option: EChartsOption = {
        backgroundColor: 'transparent',
        // Title removed as requested
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
                        // Handle both number and object data formats
                        const val = typeof p.value === 'object' ? p.value.value : p.value;
                        const seriesIndex = series.findIndex(s => s.name === p.seriesName);
                        // Safe previous value check
                        let prevVal = 0;
                        if (p.dataIndex > 0 && seriesIndex !== -1) {
                            const prevData = series[seriesIndex].data[p.dataIndex - 1];
                            prevVal = typeof prevData === 'object' ? (prevData as any).value : prevData as number;
                        }

                        const change = p.dataIndex > 0 ? val - prevVal : 0;
                        const changeStr = change !== 0 ?
                            `<span style="color:${change > 0 ? '#4caf50' : '#f44336'}">(${change > 0 ? '+' : ''}${change})</span>` : '';
                        return `<div style="display:flex;justify-content:space-between;gap:30px;font-size:15px;margin-bottom:4px;">
                            <span>${p.marker} ${p.seriesName}</span>
                            <span><strong>${val}</strong> ${changeStr}</span>
                        </div>`;
                    })
                    .join('');
                return header + items;
            }
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 20,
            top: 60, // Adjusted top since title is gone
            bottom: 80,
            itemWidth: 25,
            itemHeight: 25,
            itemGap: 20,
            textStyle: {
                color: '#fff',
                fontSize: 18,
                fontWeight: 'bold'
            },
            pageTextStyle: {
                color: '#fff'
            },
            pageIconColor: '#00f3ff',
            pageIconInactiveColor: '#555'
        },
        grid: {
            left: 80,
            right: 250, // Increased right margin for longer labels
            top: 60, // Reduced top margin since title is gone
            bottom: 100,
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
                fontSize: 16,
                rotate: xAxisData.length > 20 ? 45 : 0,
                margin: 16
            }
        },
        yAxis: {
            type: 'value',
            min: (value) => Math.floor(value.min - 50), // Offset below min value
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
                fontSize: 16,
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
