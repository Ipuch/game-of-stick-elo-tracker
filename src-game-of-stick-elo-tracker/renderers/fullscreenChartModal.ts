/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Shared Fullscreen ECharts Modal
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { ChartData, buildEchartsOptions } from '../utils/chartUtils';

// Modal state
let modalElement: HTMLDivElement | null = null;
let chartInstance: any = null;
let stylesInjected = false;

/**
 * Show fullscreen interactive ECharts modal
 * @param chartData - Prepared chart data from buildChartData
 * @param title - Optional title for the modal header
 */
export async function showFullscreenEloChart(chartData: ChartData, title: string = 'ELO Evolution Chart') {
    if (chartData.totalMatches === 0 || chartData.players.length === 0) {
        alert('No match data available to display.');
        return;
    }

    // Dynamic import for ECharts
    let echarts;
    try {
        echarts = await import('echarts');
    } catch (e) {
        console.error('Failed to load chart library', e);
        alert('Could not load charting library. Please check your connection.');
        return;
    }

    // Create modal if needed
    if (!modalElement) {
        modalElement = createModal();
        injectStyles();
    }

    // Update title
    const titleEl = modalElement.querySelector('.echarts-modal-title');
    if (titleEl) titleEl.textContent = `📈 ${title}`;

    // Show modal
    modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Initialize chart
    const container = document.getElementById('shared-echarts-container');
    if (!container) return;

    if (chartInstance) {
        chartInstance.dispose();
    }

    chartInstance = echarts.init(container, 'dark');

    // Build and set options
    const options = buildEchartsOptions(chartData, title);
    chartInstance.setOption(options);

    // Handle resize
    const resizeHandler = () => chartInstance?.resize();
    window.addEventListener('resize', resizeHandler);
}

/**
 * Hide the fullscreen chart modal
 */
export function hideFullscreenEloChart() {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
    if (chartInstance) {
        chartInstance.dispose();
        chartInstance = null;
    }
}

/**
 * Create the modal DOM element
 */
function createModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.id = 'shared-echarts-modal';
    modal.innerHTML = `
        <div class="echarts-modal-backdrop"></div>
        <div class="echarts-modal-content">
            <div class="echarts-modal-header">
                <h2 class="echarts-modal-title">📈 ELO Evolution Chart</h2>
                <div class="echarts-modal-actions">
                    <button id="shared-echarts-reset" class="echarts-btn">Reset Zoom</button>
                    <button id="shared-echarts-close" class="echarts-btn echarts-btn-close">✕ Close</button>
                </div>
            </div>
            <div id="shared-echarts-container"></div>
            <div class="echarts-modal-footer">
                <p>💡 Tip: Click legend items to toggle players • Scroll to zoom • Drag to pan</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.echarts-modal-backdrop')?.addEventListener('click', hideFullscreenEloChart);
    modal.querySelector('#shared-echarts-close')?.addEventListener('click', hideFullscreenEloChart);
    modal.querySelector('#shared-echarts-reset')?.addEventListener('click', () => {
        if (chartInstance) {
            chartInstance.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
        }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElement?.style.display !== 'none') {
            hideFullscreenEloChart();
        }
    });

    return modal;
}

/**
 * Inject modal styles
 */
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
        #shared-echarts-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 10000;
            display: none;
            justify-content: center;
            align-items: center;
        }
        #shared-echarts-modal .echarts-modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(5px);
        }
        #shared-echarts-modal .echarts-modal-content {
            position: relative;
            width: 95vw;
            height: 90vh;
            background: rgba(10, 14, 23, 0.95); /* Matches app header/bg */
            backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid var(--surface-border);
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #shared-echarts-modal .echarts-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid var(--surface-border);
            background: rgba(0, 0, 0, 0.2);
        }
        #shared-echarts-modal .echarts-modal-header h2 {
            color: var(--text-main);
            font-family: 'Orbitron', sans-serif;
            font-size: 1.5rem;
            margin: 0;
            background: linear-gradient(90deg, #fff, var(--primary-color));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        #shared-echarts-modal .echarts-modal-header h2::before {
            display: none;
        }
        #shared-echarts-modal .echarts-modal-actions {
            display: flex;
            gap: 10px;
        }
        #shared-echarts-modal .echarts-btn {
            padding: 8px 16px;
            border: 1px solid var(--surface-border);
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            width: auto;
            font-family: 'Outfit', sans-serif;
        }
        #shared-echarts-modal .echarts-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.3);
        }
        #shared-echarts-modal .echarts-btn-close {
            background: rgba(255, 0, 85, 0.1);
            border-color: rgba(255, 0, 85, 0.3);
            color: var(--accent-color);
        }
        #shared-echarts-modal .echarts-btn-close:hover {
            background: var(--accent-color);
            color: #fff;
        }
        #shared-echarts-container {
            flex: 1;
            width: 100%;
        }
        #shared-echarts-modal .echarts-modal-footer {
            padding: 10px 20px;
            text-align: center;
            border-top: 1px solid var(--surface-border);
            background: rgba(0, 0, 0, 0.2);
        }
        #shared-echarts-modal .echarts-modal-footer p {
            color: var(--text-muted);
            font-size: 12px;
            margin: 0;
        }
    `;
    document.head.appendChild(style);
}
