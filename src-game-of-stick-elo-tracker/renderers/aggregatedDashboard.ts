/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Aggregated Dashboard Renderer
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Match } from '../types/appTypes';
import { AggregatedStats, AggregatedPlayer, TimeSegment, generateTimeSegments, aggregatePlayerStats, loadAllMatchesFromLibrary } from '../utils/aggregationUtils';
import { generateAggregatedPDF } from '../utils/pdfExport';
import { generateAggregatedInstagramStories } from '../utils/instagramExport';
import { showNotification } from '../ui/notificationSystem';
import { ChartData, buildChartData, getPlayerColor } from '../utils/chartUtils';
import { showFullscreenChart, hideFullscreenChart } from './eloEvolutionChartEcharts';
import { calculateWinRate } from '../utils/statsUtils';
import { t } from '../utils/i18n';

export type AggregatedDashboardCallbacks = {
    onBack: () => void;
};

let allMatches: Match[] = [];
let availableSegments: TimeSegment[] = [];
let currentSegment: TimeSegment | null = null;
let currentStats: AggregatedStats | null = null;
let expandedSections: Set<string> = new Set(['leaderboard']); // Start with leaderboard expanded

// Cached chart data for fullscreen
let cachedChartData: ChartData | null = null;

/**
 * Render the aggregated dashboard view
 */
export async function renderAggregatedDashboard(
    libraryHandle: FileSystemDirectoryHandle,
    callbacks: AggregatedDashboardCallbacks
) {
    const container = document.getElementById('aggregated-dashboard');
    if (!container) {
        console.error('Aggregated dashboard container not found');
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div class="aggregated-loading">
            <div class="loading-spinner"></div>
            <p>${t('aggregated.loading')}</p>
        </div>
    `;
    container.style.display = 'block';

    // Hide other views
    document.getElementById('game-menu')!.style.display = 'none';
    document.getElementById('app-main')!.style.display = 'none';

    try {
        // Load all matches and generate segments if needed
        if (allMatches.length === 0) {
            const result = await loadAllMatchesFromLibrary(libraryHandle);
            allMatches = result.matches;
            availableSegments = generateTimeSegments(allMatches);

            // Default to most recent month if available, otherwise first segment (All Time)
            const recentMonth = availableSegments.find(s => s.type === 'month');
            currentSegment = recentMonth || availableSegments[0];
        }

        if (currentSegment) {
            currentStats = aggregatePlayerStats(allMatches, currentSegment);
            renderDashboardContent(container, libraryHandle, callbacks);
        }
    } catch (e) {
        console.error('Failed to load aggregated stats:', e);
        showNotification('Failed to load aggregated stats', 'error');
        container.innerHTML = `
            <div class="aggregated-error">
                <h2>${t('aggregated.errorLoading')}</h2>
                <p>${t('aggregated.errorMsg')}</p>
                <button class="button-secondary" id="agg-back-btn">${t('aggregated.backToLibrary')}</button>
            </div>
        `;
        document.getElementById('agg-back-btn')?.addEventListener('click', callbacks.onBack);
    }
}

function renderDashboardContent(
    container: HTMLElement,
    libraryHandle: FileSystemDirectoryHandle,
    callbacks: AggregatedDashboardCallbacks
) {
    if (!currentStats) return;

    const { players, matches, totalMatches, totalGames, dateRange } = currentStats;

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    container.innerHTML = `
        <div class="aggregated-header">
            <button class="button-secondary agg-back-btn" id="agg-back-btn">${t('aggregated.backToLibrary')}</button>
            <h1>${t('aggregated.title')}</h1>
            <div class="agg-subtitle">
                ${totalGames} ${t('aggregated.games')} • ${totalMatches} ${t('aggregated.matches')} • ${players.length} ${t('aggregated.players')}
            </div>
        </div>

        <div class="agg-filters">
            <div class="filter-group" style="display: flex; align-items: center; gap: 1rem;">
                <label style="color: var(--text-muted); font-family: 'Orbitron', sans-serif; font-size: 0.85rem; letter-spacing: 1px;" class="filter-label">${t('aggregated.timePeriod')}</label>
                <div class="period-selector-container" id="period-selector-container">
                    <div class="period-select-trigger" id="period-select-trigger">
                        <span>${currentSegment?.label || t('aggregated.selectPeriod')}</span>
                        <span class="arrow">▼</span>
                    </div>
                    <div class="period-options-list" id="period-options-list">
                        ${availableSegments.map(s => `
                            <div class="period-option ${currentSegment?.id === s.id ? 'selected' : ''}" data-value="${s.id}">
                                <span>${s.label}</span>
                                <span class="period-option-type">${s.type === 'all' ? '∞' : s.type === 'year' ? '📅' : '🗓️'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        ${totalMatches > 0 ? `
            <div class="agg-date-range">
                📅 ${formatDate(dateRange.start)} — ${formatDate(dateRange.end)}
            </div>
        ` : ''}

        <!-- K-Factor Info & Settings -->
        <div class="agg-kfactor-panel">
            <div class="kfactor-info">
                <span class="kfactor-badge" title="K-Factor used for ELO calculation in aggregated stats">
                    K = 60
                </span>
                <span class="kfactor-hint">
                    ${t('aggregated.kFactorHint')}
                </span>
            </div>
        </div>

        <style>
            .agg-kfactor-panel {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                padding: 0.5rem 1rem;
                margin: 0.5rem 0;
            }
            .kfactor-info {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid var(--surface-border);
                border-radius: 6px;
                padding: 0.5rem 1rem;
            }
            .kfactor-badge {
                background: linear-gradient(135deg, rgba(0, 243, 255, 0.15), rgba(0, 243, 255, 0.05));
                border: 1px solid var(--primary-color);
                color: var(--primary-color);
                font-family: 'Orbitron', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                padding: 0.3rem 0.7rem;
                border-radius: 4px;
                cursor: help;
            }
            .kfactor-hint {
                color: var(--text-muted);
                font-size: 0.75rem;
                max-width: 300px;
                line-height: 1.3;
            }
        </style>

        <div class="agg-actions">
            <button class="button-secondary" id="agg-export-pdf">${t('aggregated.exportPdf')}</button>
            <button class="button-secondary" id="agg-export-instagram">${t('aggregated.exportInstagram')}</button>
        </div>

        ${players.length === 0 ? `
            <div class="agg-empty">
                <p>${t('aggregated.noMatchesRange')}</p>
                <p class="text-muted">${t('aggregated.tryDifferentPeriod')}</p>
            </div>
        ` : `
            <!-- Collapsible Sections -->
            <div class="agg-sections">
                <!-- Leaderboard Section -->
                <div class="agg-section ${expandedSections.has('leaderboard') ? 'expanded' : ''}" data-section="leaderboard">
                    <div class="agg-section-header">
                        <h2>${t('aggregated.leaderboard')}</h2>
                        <span class="toggle-icon">${expandedSections.has('leaderboard') ? '▼' : '▶'}</span>
                    </div>
                    <div class="agg-section-content">
                        ${renderLeaderboardTable(players)}
                    </div>
                </div>

                <!-- ELO Evolution Chart Section -->
                <div class="agg-section ${expandedSections.has('chart') ? 'expanded' : ''}" data-section="chart">
                    <div class="agg-section-header">
                        <h2>${t('aggregated.eloEvolution')}</h2>
                        <span class="toggle-icon">${expandedSections.has('chart') ? '▼' : '▶'}</span>
                    </div>
                    <div class="agg-section-content">
                        <div id="agg-elo-chart-wrapper" style="position: relative;">
                            ${renderEloEvolutionChart(players, matches)}
                            <div id="agg-fullscreen-btn" class="agg-fullscreen-btn" title="Open interactive fullscreen chart">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M9 21H3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M21 3L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M3 21L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Player Profiles Section -->
                <div class="agg-section ${expandedSections.has('profiles') ? 'expanded' : ''}" data-section="profiles">
                    <div class="agg-section-header">
                        <h2>${t('aggregated.profiles')}</h2>
                        <span class="toggle-icon">${expandedSections.has('profiles') ? '▼' : '▶'}</span>
                    </div>
                    <div class="agg-section-content">
                        ${renderPlayerProfiles(players, matches)}
                    </div>
                </div>

                <!-- Match History Section -->
                <div class="agg-section ${expandedSections.has('history') ? 'expanded' : ''}" data-section="history">
                    <div class="agg-section-header">
                        <h2>${t('aggregated.matchHistory')}</h2>
                        <span class="toggle-icon">${expandedSections.has('history') ? '▼' : '▶'}</span>
                    </div>
                    <div class="agg-section-content">
                        ${renderMatchHistory(matches)}
                    </div>
                </div>
            </div>

            <div class="agg-game-list">
                <h3>${t('aggregated.gamesIncluded')}</h3>
                <div class="game-chips">
                    ${currentStats.gameNames.map(name => `
                        <span class="game-chip">${escapeHtml(name)}</span>
                    `).join('')}
                </div>
            </div>
        `}
    `;

    // Bind event listeners
    document.getElementById('agg-back-btn')?.addEventListener('click', callbacks.onBack);

    // Custom Period Selector
    const selectorContainer = document.getElementById('period-selector-container');
    const trigger = document.getElementById('period-select-trigger');
    const optionsList = document.getElementById('period-options-list');

    // Toggle dropdown open/close
    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        selectorContainer?.classList.toggle('open');
    });

    // Option selection
    optionsList?.querySelectorAll('.period-option').forEach(opt => {
        opt.addEventListener('click', async () => {
            const val = opt.getAttribute('data-value');
            if (val && val !== currentSegment?.id) {
                const segment = availableSegments.find(s => s.id === val);
                if (segment) {
                    currentSegment = segment;
                    await renderAggregatedDashboard(libraryHandle, callbacks);
                }
            }
        });
    });

    // Close dropdown when clicking outside
    container.onclick = (e) => {
        if (selectorContainer && !selectorContainer.contains(e.target as Node)) {
            selectorContainer.classList.remove('open');
        }
    };

    // Fullscreen chart button
    cachedChartData = buildChartDataFromAggregated(players, matches);
    document.getElementById('agg-fullscreen-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cachedChartData) {
            showFullscreenChart(cachedChartData, `ELO Evolution - ${currentSegment?.label}`);
        }
    });

    // Section toggles
    container.querySelectorAll('.agg-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.agg-section');
            const sectionName = section?.getAttribute('data-section');
            if (sectionName) {
                if (expandedSections.has(sectionName)) {
                    expandedSections.delete(sectionName);
                    section?.classList.remove('expanded');
                } else {
                    expandedSections.add(sectionName);
                    section?.classList.add('expanded');
                }
                // Update toggle icon
                const icon = header.querySelector('.toggle-icon');
                if (icon) {
                    icon.textContent = expandedSections.has(sectionName) ? '▼' : '▶';
                }
            }
        });
    });

    // PDF Export
    document.getElementById('agg-export-pdf')?.addEventListener('click', () => {
        if (currentStats && currentSegment) {
            generateAggregatedPDF(currentStats, currentSegment.label);
        }
    });

    // Instagram Stories Export
    document.getElementById('agg-export-instagram')?.addEventListener('click', async () => {
        if (currentStats && currentSegment) {
            showNotification(t('aggregated.generatingStories'));
            try {
                await generateAggregatedInstagramStories(currentStats, currentSegment.label);
                showNotification(t('aggregated.storiesExported'));
            } catch (e) {
                console.error(e);
                showNotification(t('aggregated.failedExport'), 'error');
            }
        }
    });
}

function renderLeaderboardTable(players: AggregatedPlayer[]): string {
    return `
        <div class="agg-leaderboard-container">
            <table class="agg-leaderboard">
                <thead>
                    <tr>
                        <th>${t('aggregated.th_rank')}</th>
                        <th>${t('aggregated.th_player')}</th>
                        <th>${t('aggregated.th_elo')}</th>
                        <th>${t('aggregated.th_w')}</th>
                        <th>${t('aggregated.th_l')}</th>
                        <th>${t('aggregated.th_d')}</th>
                        <th>${t('aggregated.th_matches')}</th>
                        <th>${t('aggregated.th_games')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map((p, i) => `
                        <tr class="${i < 3 ? 'top-' + (i + 1) : ''}">
                            <td class="rank">${getRankBadge(i + 1)}</td>
                            <td class="player-name">${escapeHtml(p.name)}</td>
                            <td class="elo"><strong>${p.elo}</strong></td>
                            <td class="wins">${p.wins}</td>
                            <td class="losses">${p.losses}</td>
                            <td class="draws">${p.draws}</td>
                            <td class="matches">${p.matchCount}</td>
                            <td class="games">${p.gamesParticipated.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Build ELO history for all players with flat lines until their first match
 * and extending to the end of all matches
 */
function buildAggregatedEloHistory(players: AggregatedPlayer[], matches: Match[]) {
    const initialElo = 1200; // DEFAULT_ELO_CONFIG.initialRating

    // Build a full-length ELO array for each player
    // Each player's ELO stays flat at 1200 until their first match,
    // then tracks their actual ELO, then stays flat until the end
    const playerFullHistories: Map<string, number[]> = new Map();

    // Initialize all players with initial ELO for the start point
    players.forEach(p => {
        playerFullHistories.set(p.normalizedName, [initialElo]);
    });

    // Current ELO tracking (starts at initial)
    const currentElos: Map<string, number> = new Map();
    players.forEach(p => currentElos.set(p.normalizedName, initialElo));

    // Process each match in order
    matches.forEach(m => {
        const p1Name = m.player1Name.toLowerCase().trim();
        const p2Name = m.player2Name.toLowerCase().trim();

        // Find player data for these names
        const p1 = players.find(p => p.normalizedName === p1Name);
        const p2 = players.find(p => p.normalizedName === p2Name);

        // Get ELO changes from the original match data if available
        // Otherwise the aggregation already computed cumulative ELO
        if (p1) {
            const history = p1.eloHistory;
            // Find the ELO at this point in time
            const matchTime = m.timestamp;
            const eloPoint = history.find(h => h.timestamp === matchTime);
            if (eloPoint) {
                currentElos.set(p1Name, eloPoint.elo);
            }
        }
        if (p2) {
            const history = p2.eloHistory;
            const matchTime = m.timestamp;
            const eloPoint = history.find(h => h.timestamp === matchTime);
            if (eloPoint) {
                currentElos.set(p2Name, eloPoint.elo);
            }
        }

        // For each player, add their current ELO to history
        players.forEach(p => {
            const history = playerFullHistories.get(p.normalizedName)!;
            history.push(currentElos.get(p.normalizedName) || initialElo);
        });
    });

    return playerFullHistories;
}

function renderEloEvolutionChart(players: AggregatedPlayer[], matches: Match[]): string {
    if (matches.length === 0 || players.length === 0) {
        return '<p style="color: #888; text-align: center; padding: 40px;">No match data available.</p>';
    }

    const svgWidth = 800;
    // Dynamic height based on number of players for the legend
    // Base height 400px, add space if we have many players
    // Legend starts at top + 15, each item is 22px high
    const legendHeight = 15 + players.length * 22 + 50; // +50 padding
    const svgHeight = Math.max(400, legendHeight);

    const padding = { top: 40, right: 150, bottom: 50, left: 60 };
    const graphWidth = svgWidth - padding.left - padding.right;
    const graphHeight = svgHeight - padding.top - padding.bottom;

    // Build full ELO histories (flat until first match, extending to end)
    const fullHistories = buildAggregatedEloHistory(players, matches);
    const numPoints = matches.length + 1; // +1 for start point

    // Get all ELO points from all players for min/max
    let minElo = 1200, maxElo = 1200;
    fullHistories.forEach(history => {
        history.forEach(elo => {
            minElo = Math.min(minElo, elo);
            maxElo = Math.max(maxElo, elo);
        });
    });
    const eloMargin = Math.max(50, (maxElo - minElo) * 0.1);
    minElo = Math.floor((minElo - eloMargin) / 50) * 50;
    maxElo = Math.ceil((maxElo + eloMargin) / 50) * 50;
    const eloRange = maxElo - minElo || 100;

    const xScale = (index: number) => padding.left + (index / Math.max(numPoints - 1, 1)) * graphWidth;
    const yScale = (elo: number) => padding.top + graphHeight - ((elo - minElo) / eloRange) * graphHeight;

    let svg = `
    <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px;">
        <defs>
            <linearGradient id="aggBgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
            </linearGradient>
            <filter id="aggGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#aggBgGradient)" rx="12"/>
    `;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
        const elo = minElo + (eloRange / 5) * i;
        const y = yScale(elo);
        svg += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
        svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(255,255,255,0.5)">${Math.round(elo)}</text>`;
    }

    // Axis labels
    svg += `<text x="${padding.left + graphWidth / 2}" y="${svgHeight - 10}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.6)">Matches (${matches.length} total across all games)</text>`;

    // Draw player curves (sorted by final ELO)
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    sortedPlayers.forEach((player, idx) => {
        const color = getPlayerColor(idx);
        const history = fullHistories.get(player.normalizedName) || [1200];
        const points = history.map((elo, i) => `${xScale(i).toFixed(1)},${yScale(elo).toFixed(1)}`).join(' L ');

        // Area under curve
        const lastX = xScale(history.length - 1);
        const firstX = xScale(0);
        const areaPath = `M ${xScale(0)},${yScale(history[0])} L ${points} L ${lastX},${yScale(minElo)} L ${firstX},${yScale(minElo)} Z`;
        svg += `<path d="${areaPath}" fill="${color}" fill-opacity="0.1"/>`;

        // Line
        svg += `<path d="M ${points}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" filter="url(#aggGlow)"/>`;

        // Endpoint
        const lastElo = history[history.length - 1];
        svg += `<circle cx="${lastX}" cy="${yScale(lastElo)}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
    });

    // Legend (All players)
    sortedPlayers.forEach((player, i) => {
        const color = getPlayerColor(i);
        const yPos = padding.top + 15 + i * 22;
        const truncName = player.name.length > 10 ? player.name.substring(0, 10) + '…' : player.name;
        svg += `<rect x="${padding.left + graphWidth + 15}" y="${yPos - 8}" width="12" height="12" rx="2" fill="${color}"/>`;
        svg += `<text x="${padding.left + graphWidth + 32}" y="${yPos + 2}" font-size="11" fill="#fff">${truncName}</text>`;
        svg += `<text x="${padding.left + graphWidth + 120}" y="${yPos + 2}" font-size="10" fill="rgba(255,255,255,0.6)">${player.elo}</text>`;
    });

    svg += '</svg>';
    return svg;
}

function renderPlayerProfiles(players: AggregatedPlayer[], matches: Match[]): string {
    return `
        <div class="agg-profiles">
            ${players.map((player, idx) => {
        const winRate = calculateWinRate(player.wins, player.losses, player.draws);
        const color = getPlayerColor(idx);

        // Get player matches
        const playerMatches = matches.filter(m =>
            m.player1Name.toLowerCase() === player.normalizedName ||
            m.player2Name.toLowerCase() === player.normalizedName
        ).slice(-5).reverse(); // Last 5 matches

        return `
                    <div class="agg-profile-card" style="border-left: 4px solid ${color}">
                        <div class="profile-header">
                            <span class="profile-rank">#${idx + 1}</span>
                            <span class="profile-name">${escapeHtml(player.name)}</span>
                            <span class="profile-elo">${player.elo} ELO</span>
                        </div>
                        <div class="profile-stats">
                            <span class="stat win">${player.wins}W</span>
                            <span class="stat loss">${player.losses}L</span>
                            <span class="stat draw">${player.draws}D</span>
                            <span class="stat winrate">${winRate}% WR</span>
                            <span class="stat games">${player.gamesParticipated.length} game${player.gamesParticipated.length !== 1 ? 's' : ''}</span>
                        </div>
                        ${playerMatches.length > 0 ? `
                            <div class="profile-recent">
                                <strong>${t('aggregated.recent')}</strong>
                                ${playerMatches.map(m => {
            const isP1 = m.player1Name.toLowerCase() === player.normalizedName;
            const result = m.outcome === 'draw' ? 'D' :
                (isP1 && m.outcome === 'p1') || (!isP1 && m.outcome === 'p2') ? 'W' : 'L';
            const opponent = isP1 ? m.player2Name : m.player1Name;
            const resultClass = result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw';
            return `<span class="recent-match ${resultClass}" title="vs ${opponent}">${result}</span>`;
        }).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderMatchHistory(matches: Match[]): string {
    const recentMatches = [...matches].reverse().slice(0, 50); // Last 50 matches

    if (recentMatches.length === 0) {
        return '<p style="color: #888; text-align: center; padding: 20px;">No matches found.</p>';
    }

    return `
        <div class="agg-history">
            ${recentMatches.map(m => {
        const date = new Date(m.timestamp);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const gameName = (m as any).gameName || 'Unknown';
        const resultStr = m.outcome === 'draw' ? t('profile.draw') :
            m.outcome === 'p1' ? `${m.player1Name} ${t('aggregated.won')}` : `${m.player2Name} ${t('aggregated.won')}`;
        const resultClass = m.outcome === 'draw' ? 'draw' : 'win';

        return `
                    <div class="history-item">
                        <span class="history-date">${dateStr}</span>
                        <span class="history-game">${escapeHtml(gameName)}</span>
                        <span class="history-players">${escapeHtml(m.player1Name)} vs ${escapeHtml(m.player2Name)}</span>
                        <span class="history-result ${resultClass}">${resultStr}</span>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function getRankBadge(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Convert aggregated player/match data to shared ChartData format
 */
function buildChartDataFromAggregated(players: AggregatedPlayer[], matches: Match[]): ChartData {
    // Build chartPlayers from aggregated players
    const chartPlayers = players.map(p => ({
        key: p.normalizedName,
        name: p.name,
        currentElo: p.elo
    }));

    // Build chartMatches from matches
    const chartMatches = matches.map(m => ({
        timestamp: m.timestamp,
        player1Key: m.player1Name.toLowerCase().trim(),
        player2Key: m.player2Name.toLowerCase().trim(),
        player1EloAfter: m.player1EloAfter,
        player2EloAfter: m.player2EloAfter
    }));

    return buildChartData(chartPlayers, chartMatches);
}


/**
 * Hide the aggregated dashboard
 */
export function hideAggregatedDashboard() {
    const container = document.getElementById('aggregated-dashboard');
    if (container) {
        container.style.display = 'none';
    }
    hideFullscreenChart();
}

