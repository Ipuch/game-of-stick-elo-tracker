/**
 * Live Event Display Renderer for Game of STICK
 * Provides a TV-ready view with auto-scrolling leaderboard and rotating highlights
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { t } from '../utils/i18n';
import {
    StoryHighlight,
    collectAllHighlights,
    findCurrentChampion
} from '../utils/storyHighlights';
import { DEFAULT_ELO_CONFIG } from '../scoring/eloScoring';

// =============================================================================
// CONFIGURATION (Easy to modify)
// =============================================================================

const CONFIG = {
    /** Time each highlight is shown (ms) */
    HIGHLIGHT_ROTATION_INTERVAL: 8000,
    /** Scroll speed: seconds per player row */
    SCROLL_SECONDS_PER_ROW: 2,
    /** Pause at top/bottom before reversing scroll (ms) */
    SCROLL_PAUSE_DURATION: 5000,
    /** Number of visible players before auto-scroll activates */
    VISIBLE_PLAYERS_THRESHOLD: 10,
    /** Transition duration for highlight cards (ms) */
    HIGHLIGHT_TRANSITION_DURATION: 500,
};

// =============================================================================
// STATE
// =============================================================================

let currentHighlightIndex = 0;
let highlightRotationTimer: number | null = null;
let scrollAnimationId: number | null = null;
let isScrollingDown = true;
let scrollPauseTimeout: number | null = null;
let isActive = false;

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

export function renderLiveDisplay(
    container: HTMLElement,
    players: Player[],
    matches: Match[],
    gameName: string,
    previousEloSnapshot: Record<string, number>,
    currentEloSnapshot?: Record<string, number>,
    previousRankSnapshot?: Record<string, number>,
    currentRankSnapshot?: Record<string, number>
): void {
    // Sort by SNAPSHOTTED rank if available (frozen display), otherwise by current ELO
    let sortedPlayers: Player[];
    if (currentRankSnapshot && Object.keys(currentRankSnapshot).length > 0) {
        sortedPlayers = [...players].sort((a, b) => {
            const rankA = currentRankSnapshot[a.id] ?? 9999;
            const rankB = currentRankSnapshot[b.id] ?? 9999;
            return rankA - rankB;
        });
    } else {
        sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    }

    const highlights = collectAllHighlights(players, matches, previousRankSnapshot, currentRankSnapshot);

    // Ensure we have at least champion highlight
    if (highlights.length === 0) {
        const champion = findCurrentChampion(players);
        if (champion) highlights.push(champion);
    }

    container.innerHTML = `
        <div class="live-display">
            <header class="live-header">
                <div class="live-header-left">
                    <span class="live-branding">🏆 GAME OF STICK</span>
                    <span class="live-game-name">${gameName}</span>
                </div>
                <div class="live-header-right">
                    <button class="live-update-btn" id="live-update-btn" title="${t('leaderboard.updateBtn')}">
                        🔄 ${t('leaderboard.updateBtn')}
                    </button>
                    <button class="live-exit-btn" id="live-exit-btn" title="${t('liveDisplay.exit')}">
                        ✕
                    </button>
                </div>
            </header>

            <div class="live-content">
                <div class="live-leaderboard-panel">
                    <h2 class="live-panel-title">${t('liveDisplay.leaderboard')}</h2>
                    <div class="live-leaderboard-container" id="live-leaderboard-container">
                        <div class="live-leaderboard-scroll" id="live-leaderboard-scroll">
                            ${renderLeaderboardRows(sortedPlayers, previousEloSnapshot, currentEloSnapshot, previousRankSnapshot, currentRankSnapshot)}
                        </div>
                    </div>
                </div>

                <div class="live-highlights-panel">
                    <h2 class="live-panel-title">${t('liveDisplay.highlights')}</h2>
                    <div class="live-highlight-card-container" id="live-highlight-container">
                        ${highlights.length > 0 ? renderHighlightCard(highlights[0]) : ''}
                    </div>
                    <div class="live-highlight-dots" id="live-highlight-dots">
                        ${highlights.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Store highlights data for rotation
    container.dataset.highlights = JSON.stringify(highlights);

    // Start animations
    startHighlightRotation(highlights);
    setupDotListeners(highlights);
    startLeaderboardScroll(sortedPlayers.length);

    isActive = true;
}

// =============================================================================
// LEADERBOARD RENDERING
// =============================================================================

function renderLeaderboardRows(
    players: Player[],
    previousEloSnapshot: Record<string, number>,
    currentEloSnapshot?: Record<string, number>,
    previousRankSnapshot?: Record<string, number>,
    currentRankSnapshot?: Record<string, number>
): string {
    if (players.length === 0) {
        return `<div class="live-no-players">${t('profile.noPlayers')}</div>`;
    }

    return players.map((player, index) => {
        // Use FROZEN rank from snapshot, not current sort position
        const displayedRank = currentRankSnapshot?.[player.id] ?? (index + 1);
        const previousRank = previousRankSnapshot?.[player.id];

        // Calculate ELO diff: frozen diff = currentSnapshot - previousSnapshot
        const currentElo = currentEloSnapshot ? (currentEloSnapshot[player.id] ?? player.elo) : player.elo;
        const prevElo = previousEloSnapshot[player.id] ?? DEFAULT_ELO_CONFIG.initialRating;
        const eloDiff = currentElo - prevElo;
        const eloDiffHtml = eloDiff !== 0
            ? `<span class="live-elo-diff ${eloDiff > 0 ? 'elo-up' : 'elo-down'}">
                ${eloDiff > 0 ? '+' : '-'}${Math.abs(eloDiff)}
               </span>`
            : '<span class="live-elo-diff placeholder"></span>';

        // Rank change indicator using frozen snapshots
        let rankChangeHtml = '';
        if (previousRank !== undefined) {
            const diff = previousRank - displayedRank;
            if (diff > 0) {
                rankChangeHtml = `<span class="live-rank-change rank-up">▲${diff}</span>`;
            } else if (diff < 0) {
                rankChangeHtml = `<span class="live-rank-change rank-down">▼${Math.abs(diff)}</span>`;
            } else {
                rankChangeHtml = `<span class="live-rank-change rank-no-change">=</span>`;
            }
        }

        return `
            <div class="live-leaderboard-row ${displayedRank <= 3 ? 'top-' + displayedRank : ''}">
                <div class="live-rank-col">
                    <span class="live-rank-number">${displayedRank}</span>
                    <div class="live-rank-indicators">
                        ${rankChangeHtml}
                    </div>
                </div>
                
                <div class="live-player-col">
                    <div class="live-player-name">${player.name}</div>
                </div>
                
                <div class="live-elo-col">
                    <div class="live-elo-wrapper">
                        <span class="live-elo-value">${player.elo}</span>
                        ${eloDiffHtml}
                    </div>
                </div>
                
                <div class="live-stats-col">
                    <div class="live-stat-item wins">
                        <span class="stat-val">${player.wins}</span>
                        <span class="stat-label">${t('leaderboard.wins')}</span>
                    </div>
                    <div class="live-stat-item losses">
                        <span class="stat-val">${player.losses}</span>
                        <span class="stat-label">${t('leaderboard.losses')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}



// =============================================================================
// HIGHLIGHT CARD RENDERING
// =============================================================================

function renderHighlightCard(highlight: StoryHighlight): string {
    const labels = getHighlightLabels();
    let label = labels[highlight.type] || highlight.type;

    if (highlight.type === 'streak' && highlight.metadata?.isSecond) {
        label = t('stories.unstoppable2') || t('stories.unstoppable') + ' #2';
    }

    let valueDisplay = '';
    let subDisplay = '';

    switch (highlight.type) {
        case 'streak':
            valueDisplay = `${highlight.value}`;
            subDisplay = t('stories.consecutiveWins');
            break;
        case 'rank_climb':
            valueDisplay = `+${highlight.value}`;
            subDisplay = highlight.description;
            break;
        case 'elo_gain':
            valueDisplay = `+${highlight.value}`;
            subDisplay = t('stories.pointsInOneMatch');
            break;
        case 'upset':
            valueDisplay = `${highlight.value}%`;
            subDisplay = t('stories.winProbability');
            break;
        case 'champion':
            valueDisplay = `${highlight.value}`;
            subDisplay = `${t('stories.eloRating')} • ${highlight.description}`;
            break;
        case 'most_active':
            valueDisplay = `${highlight.value}`;
            subDisplay = `${t('liveDisplay.matchesPlayed')} • ${highlight.description}`;
            break;
        case 'top_duel':
            valueDisplay = `${highlight.value}`;
            subDisplay = `${t('stories.vs')} ${highlight.opponent} (${highlight.secondaryValue})`;
            if (highlight.description && !highlight.description.includes('#1 vs #2')) {
                subDisplay += `<br><span style="color: var(--live-success); font-weight: 600;">${highlight.description}</span>`;
            }
            break;
    }

    if (highlight.type === 'top_duel') {
        // SPECIAL LAYOUT FOR CLASH OF TITANS
        const metadata = highlight.metadata || {};
        const p1Name = highlight.playerName;
        const p2Name = highlight.opponent || '???';

        // Use initial ELO from match if available, otherwise current ELO
        const p1Elo = metadata.p1Initial ?? highlight.value;
        const p2Elo = metadata.p2Initial ?? highlight.secondaryValue;

        const { winner, outcome, eloGain } = metadata;

        let resultHtml = '';
        if (outcome === 'draw') {
            resultHtml = `<div class="live-duel-result draw">${t('match.draw')}</div>`;
        } else if (winner) {
            resultHtml = `
                <div class="live-duel-result win">
                    <span class="winner-name">${winner}</span>
                    <span class="winner-badge">${t('arena.victory').toUpperCase()}</span>
                    <span class="winner-gain">+${eloGain}</span>
                </div>
             `;
        } else {
            // No match yet, or just a rivalry display
            // Optional: Show "RIVALS" or just leave empty
            resultHtml = `<div class="live-duel-result" style="background: transparent; border: none; font-size: 1.2rem; opacity: 0.7;">${t('liveDisplay.currentChampion')} vs #2</div>`;
        }

        return `
            <div class="live-highlight-card duel-card" data-type="${highlight.type}">
                 <div class="live-highlight-label">${label}</div>
                 
                 <div class="live-duel-versus">
                    <div class="duel-player p1">
                        <div class="duel-name">${p1Name}</div>
                        <div class="duel-elo">${p1Elo}</div>
                    </div>
                    
                    <div class="duel-vs">Vs</div>
                    
                    <div class="duel-player p2">
                        <div class="duel-name">${p2Name}</div>
                        <div class="duel-elo">${p2Elo}</div>
                    </div>
                 </div>

                 ${resultHtml}
            </div>
        `;
    }

    return `
        <div class="live-highlight-card" data-type="${highlight.type}">
            <div class="live-highlight-emoji">${highlight.emoji}</div>
            <div class="live-highlight-label">${label}</div>
            <div class="live-highlight-player">${highlight.playerName}</div>
            <div class="live-highlight-value">${valueDisplay}</div>
            <div class="live-highlight-sub">${subDisplay}</div>
            ${highlight.opponent && highlight.type !== 'top_duel' ? `
                <div class="live-highlight-opponent">${t('stories.vs')} ${highlight.opponent}</div>
            ` : ''}
        </div>
    `;
}

function getHighlightLabels(): Record<string, string> {
    return {
        streak: t('stories.unstoppable'),
        rank_climb: t('stories.rankClimb'),
        elo_gain: t('stories.skyrocketing'),
        upset: t('stories.underdogWin'),
        champion: t('liveDisplay.currentChampion'),
        most_active: t('liveDisplay.hungriestDog'),
        top_duel: t('liveDisplay.clashOfTitans'),
    };
}

// =============================================================================
// HIGHLIGHT ROTATION
// =============================================================================

function startHighlightRotation(highlights: StoryHighlight[]): void {
    if (highlights.length <= 1) return;

    stopHighlightRotation();

    highlightRotationTimer = window.setInterval(() => {
        currentHighlightIndex = (currentHighlightIndex + 1) % highlights.length;

        const cardContainer = document.getElementById('live-highlight-container');
        const dotsContainer = document.getElementById('live-highlight-dots');

        if (cardContainer) {
            // Fade out
            cardContainer.style.opacity = '0';
            cardContainer.style.transform = 'scale(0.95)';

            setTimeout(() => {
                cardContainer.innerHTML = renderHighlightCard(highlights[currentHighlightIndex]);
                // Fade in
                cardContainer.style.opacity = '1';
                cardContainer.style.transform = 'scale(1)';
            }, CONFIG.HIGHLIGHT_TRANSITION_DURATION);
        }

        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === currentHighlightIndex);
            });
        }
    }, CONFIG.HIGHLIGHT_ROTATION_INTERVAL);
}

function stopHighlightRotation(): void {
    if (highlightRotationTimer) {
        clearInterval(highlightRotationTimer);
        highlightRotationTimer = null;
    }
}

/**
 * Handle manual dot navigation
 */
function setupDotListeners(highlights: StoryHighlight[]): void {
    const dotsContainer = document.getElementById('live-highlight-dots');
    if (!dotsContainer) return;

    dotsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('dot')) return;

        const index = parseInt(target.getAttribute('data-index') || '0', 10);

        // Update state
        currentHighlightIndex = index;

        // Reset rotation timer
        stopHighlightRotation();
        startHighlightRotation(highlights); // Restart timer so it doesn't auto-switch immediately

        // Render immediately
        const cardContainer = document.getElementById('live-highlight-container');
        if (cardContainer) {
            // No fade out for manual click, just snap
            cardContainer.innerHTML = renderHighlightCard(highlights[currentHighlightIndex]);
            cardContainer.style.opacity = '1';
            cardContainer.style.transform = 'scale(1)';
        }

        // Update dots
        dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentHighlightIndex);
        });
    });
}

// =============================================================================
// LEADERBOARD SCROLL
// =============================================================================

function startLeaderboardScroll(playerCount: number): void {
    stopLeaderboardScroll();

    // Use a timeout to allow DOM to settle/render
    setTimeout(() => {
        const container = document.getElementById('live-leaderboard-container');
        const scrollEl = document.getElementById('live-leaderboard-scroll');

        if (!container || !scrollEl) return;

        const containerHeight = container.clientHeight;
        const scrollHeight = scrollEl.scrollHeight;
        const maxScroll = scrollHeight - containerHeight;

        // Only scroll if there is content to scroll
        if (maxScroll <= 0) {
            // Reset position if no scroll needed
            scrollEl.style.transform = `translateY(0px)`;
            return;
        }

        // Calculate duration based on how much hidden content there is
        // Estimate row height to keep speed consistent with config
        const avgRowHeight = playerCount > 0 ? scrollHeight / playerCount : 60;
        const hiddenRows = maxScroll / avgRowHeight;

        // Duration: (seconds per row * hidden rows) + extra time
        // Ensure at least a minimum duration for smoothness
        const totalScrollDuration = Math.max(hiddenRows * CONFIG.SCROLL_SECONDS_PER_ROW * 1000, 3000);

        let startTime: number | null = null;
        let currentScrollPos = 0;

        const animate = (timestamp: number) => {
            if (!isActive) return;

            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;

            if (isScrollingDown) {
                const progress = Math.min(elapsed / totalScrollDuration, 1);
                // Ease in-out could be nice, but linear is standard for teleprompter style
                currentScrollPos = progress * maxScroll;
            } else {
                const progress = Math.min(elapsed / totalScrollDuration, 1);
                currentScrollPos = maxScroll - (progress * maxScroll);
            }

            scrollEl.style.transform = `translateY(-${currentScrollPos}px)`;

            if (elapsed >= totalScrollDuration) {
                // Pause and reverse
                scrollPauseTimeout = window.setTimeout(() => {
                    isScrollingDown = !isScrollingDown;
                    startTime = null;
                    if (isActive) {
                        scrollAnimationId = requestAnimationFrame(animate);
                    }
                }, CONFIG.SCROLL_PAUSE_DURATION);
            } else {
                scrollAnimationId = requestAnimationFrame(animate);
            }
        };

        // Initial pause at top
        scrollPauseTimeout = window.setTimeout(() => {
            scrollAnimationId = requestAnimationFrame(animate);
        }, CONFIG.SCROLL_PAUSE_DURATION);
    }, 100);
}

function stopLeaderboardScroll(): void {
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
    }
    if (scrollPauseTimeout) {
        clearTimeout(scrollPauseTimeout);
        scrollPauseTimeout = null;
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function stopLiveDisplay(): void {
    isActive = false;
    stopHighlightRotation();
    stopLeaderboardScroll();
    currentHighlightIndex = 0;
    isScrollingDown = true;
}

export function refreshLiveDisplay(
    container: HTMLElement,
    players: Player[],
    matches: Match[],
    gameName: string,
    lastLeaderboardElo: Record<string, number>
): void {
    // Stop current animations
    stopLiveDisplay();

    // Re-render with new data
    renderLiveDisplay(container, players, matches, gameName, lastLeaderboardElo);
}

export function isLiveDisplayActive(): boolean {
    return isActive;
}
