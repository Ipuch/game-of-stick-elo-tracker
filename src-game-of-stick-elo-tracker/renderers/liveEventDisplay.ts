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
    
    const highlights = collectAllHighlights(players, matches);

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
                    <button class="live-update-btn" id="live-update-btn" title="${t('leaderboard.updateLeaderboard')}">
                        🔄 ${t('leaderboard.updateLeaderboard')}
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
                        ${highlights.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Store highlights data for rotation
    container.dataset.highlights = JSON.stringify(highlights);

    // Start animations
    startHighlightRotation(container, highlights);
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
        const medal = getMedalEmoji(displayedRank);
        
        // Calculate ELO diff: frozen diff = currentSnapshot - previousSnapshot
        const currentElo = currentEloSnapshot ? (currentEloSnapshot[player.id] ?? player.elo) : player.elo;
        const prevElo = previousEloSnapshot[player.id] ?? DEFAULT_ELO_CONFIG.initialRating;
        const eloDiff = currentElo - prevElo;
        const eloDiffHtml = eloDiff !== 0
            ? `<span class="live-elo-diff ${eloDiff > 0 ? 'elo-up' : 'elo-down'}">
                ${eloDiff > 0 ? '▲' : '▼'} ${Math.abs(eloDiff)}
               </span>`
            : '';

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
                <div class="live-rank">
                    <span class="live-rank-number">${displayedRank}</span>
                    ${medal ? `<span class="live-medal">${medal}</span>` : ''}
                    ${rankChangeHtml}
                </div>
                <div class="live-player-name">${player.name}</div>
                <div class="live-elo">
                    <span class="live-elo-value">${player.elo}</span>
                    ${eloDiffHtml}
                </div>
                <div class="live-stats">
                    <span class="live-wins">${player.wins}W</span>
                    <span class="live-losses">${player.losses}L</span>
                </div>
            </div>
        `;
    }).join('');
}

function getMedalEmoji(rank: number): string {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '';
    }
}

// =============================================================================
// HIGHLIGHT CARD RENDERING
// =============================================================================

function renderHighlightCard(highlight: StoryHighlight): string {
    const labels = getHighlightLabels();
    const label = labels[highlight.type] || highlight.type;

    let valueDisplay = '';
    let subDisplay = '';

    switch (highlight.type) {
        case 'streak':
            valueDisplay = `${highlight.value}`;
            subDisplay = t('stories.consecutiveWins');
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

function startHighlightRotation(container: HTMLElement, highlights: StoryHighlight[]): void {
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

// =============================================================================
// LEADERBOARD SCROLL
// =============================================================================

function startLeaderboardScroll(playerCount: number): void {
    if (playerCount <= CONFIG.VISIBLE_PLAYERS_THRESHOLD) return;

    stopLeaderboardScroll();

    const container = document.getElementById('live-leaderboard-container');
    const scrollEl = document.getElementById('live-leaderboard-scroll');
    
    if (!container || !scrollEl) return;

    const containerHeight = container.clientHeight;
    const scrollHeight = scrollEl.scrollHeight;
    const maxScroll = scrollHeight - containerHeight;

    if (maxScroll <= 0) return;

    const totalScrollDuration = (playerCount - CONFIG.VISIBLE_PLAYERS_THRESHOLD) * CONFIG.SCROLL_SECONDS_PER_ROW * 1000;
    let startTime: number | null = null;
    let currentScrollPos = 0;

    const animate = (timestamp: number) => {
        if (!isActive) return;

        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        if (isScrollingDown) {
            const progress = Math.min(elapsed / totalScrollDuration, 1);
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
