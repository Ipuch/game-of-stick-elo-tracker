/**
 * Instagram Story Export utility for Game of S.T.I.C.K.
 * Generates 1080x1920 (9:16) story images for Instagram
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AggregatedPlayer, AggregatedStats } from './aggregationUtils';
import { calculateWinRate } from './statsUtils';
import html2canvas from 'html2canvas';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

// =============================================================================
// TYPES
// =============================================================================

interface StoryHighlight {
    type: 'streak' | 'elo_gain' | 'upset';
    playerName: string;
    value: number;
    description: string;
    emoji: string;
    opponent?: string;
}

// =============================================================================
// STATS CALCULATION HELPERS
// =============================================================================

/**
 * Find the player with the biggest active win streak
 */
export function findBiggestWinStreak(players: Player[]): StoryHighlight | null {
    const streakPlayers = players
        .filter(p => p.currentStreakType === 'W' && p.currentStreakLength >= 2)
        .sort((a, b) => b.currentStreakLength - a.currentStreakLength);

    if (streakPlayers.length === 0) return null;

    const top = streakPlayers[0];
    return {
        type: 'streak',
        playerName: top.name,
        value: top.currentStreakLength,
        description: `${top.currentStreakLength}-win streak!`,
        emoji: '🔥',
    };
}

/**
 * Find the match with the biggest ELO gain
 */
export function findBiggestEloGain(matches: Match[]): StoryHighlight | null {
    if (matches.length === 0) return null;

    let bestMatch: Match | null = null;
    let bestGain = 0;
    let winnerName = '';
    let loserName = '';

    matches.forEach(match => {
        const p1Change = match.player1EloChange ?? (match.player1EloAfter - match.player1EloBefore);
        const p2Change = match.player2EloChange ?? (match.player2EloAfter - match.player2EloBefore);

        if (p1Change > bestGain) {
            bestGain = p1Change;
            bestMatch = match;
            winnerName = match.player1Name;
            loserName = match.player2Name;
        }
        if (p2Change > bestGain) {
            bestGain = p2Change;
            bestMatch = match;
            winnerName = match.player2Name;
            loserName = match.player1Name;
        }
    });

    if (!bestMatch || bestGain <= 0) return null;

    return {
        type: 'elo_gain',
        playerName: winnerName,
        value: bestGain,
        description: `+${bestGain} ELO in a single match!`,
        emoji: '⚡',
        opponent: loserName,
    };
}

/**
 * Find the biggest upset (lowest expected odds → win)
 */
export function findBiggestUpset(matches: Match[]): StoryHighlight | null {
    if (matches.length === 0) return null;

    let bestUpset: { match: Match; odds: number; winnerName: string; loserName: string } | null = null;

    for (const match of matches) {
        if (match.outcome === 'draw') continue;

        // Calculate expected odds (basic ELO formula)
        const p1Expected = 1 / (1 + Math.pow(10, (match.player2EloBefore - match.player1EloBefore) / 400));
        const p2Expected = 1 - p1Expected;

        const isP1Winner = match.outcome === 'p1';
        const winnerOdds = isP1Winner ? p1Expected : p2Expected;

        if (winnerOdds < 0.4 && (bestUpset === null || winnerOdds < bestUpset.odds)) {
            bestUpset = {
                match,
                odds: winnerOdds,
                winnerName: isP1Winner ? match.player1Name : match.player2Name,
                loserName: isP1Winner ? match.player2Name : match.player1Name,
            };
        }
    }

    if (bestUpset === null) return null;

    const oddsPercent = Math.round(bestUpset.odds * 100);
    return {
        type: 'upset',
        playerName: bestUpset.winnerName,
        value: oddsPercent,
        description: `Beat ${oddsPercent}% odds vs ${bestUpset.loserName}!`,
        emoji: '💀',
        opponent: bestUpset.loserName,
    };
}

// =============================================================================
// SHARED STYLES
// =============================================================================

function getStoryStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .story-container {
            width: ${STORY_WIDTH}px;
            height: ${STORY_HEIGHT}px;
            background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 80px 60px;
            position: relative;
            overflow: hidden;
        }
        
        /* Decorative background elements */
        .story-container::before {
            content: '';
            position: absolute;
            top: -200px;
            right: -200px;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(0,243,255,0.15) 0%, transparent 70%);
            border-radius: 50%;
        }
        
        .story-container::after {
            content: '';
            position: absolute;
            bottom: -150px;
            left: -150px;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%);
            border-radius: 50%;
        }
        
        .branding {
            font-size: 28px;
            font-weight: 600;
            color: rgba(255,255,255,0.4);
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 40px;
        }
        
        .game-name {
            font-size: 36px;
            font-weight: 700;
            color: #00f3ff;
            margin-bottom: 60px;
            text-align: center;
            text-shadow: 0 0 30px rgba(0,243,255,0.5);
        }
        
        .section-title {
            font-size: 32px;
            font-weight: 600;
            color: rgba(255,255,255,0.7);
            margin-bottom: 40px;
            letter-spacing: 2px;
        }
        
        /* Champion Story Styles */
        .champion-medal {
            font-size: 180px;
            margin-bottom: 20px;
            filter: drop-shadow(0 10px 30px rgba(255,215,0,0.4));
        }
        
        .champion-name {
            font-size: 72px;
            font-weight: 900;
            text-align: center;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #fff 0%, #00f3ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .champion-elo {
            font-size: 96px;
            font-weight: 700;
            color: #00f3ff;
            text-shadow: 0 0 40px rgba(0,243,255,0.6);
            margin-bottom: 60px;
        }
        
        .champion-elo span {
            font-size: 48px;
            color: rgba(255,255,255,0.5);
        }
        
        .stats-grid {
            display: flex;
            gap: 50px;
            margin-bottom: 60px;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-value {
            font-size: 64px;
            font-weight: 700;
        }
        
        .stat-value.wins { color: #4caf50; }
        .stat-value.losses { color: #f44336; }
        .stat-value.draws { color: #ff9800; }
        
        .stat-label {
            font-size: 24px;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .win-rate {
            font-size: 56px;
            font-weight: 700;
            color: #32CD32;
            margin-top: 40px;
        }
        
        .win-rate span {
            font-size: 28px;
            color: rgba(255,255,255,0.5);
        }
        
        /* Podium Story Styles */
        .podium-container {
            display: flex;
            flex-direction: column;
            gap: 40px;
            width: 100%;
            max-width: 900px;
            margin-top: 40px;
        }
        
        .podium-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 40px 50px;
            display: flex;
            align-items: center;
            gap: 30px;
            backdrop-filter: blur(10px);
            transition: transform 0.3s;
        }
        
        .podium-card.gold {
            background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%);
            border-color: rgba(255,215,0,0.3);
            transform: scale(1.05);
        }
        
        .podium-card.silver {
            background: linear-gradient(135deg, rgba(192,192,192,0.1) 0%, rgba(192,192,192,0.03) 100%);
            border-color: rgba(192,192,192,0.2);
        }
        
        .podium-card.bronze {
            background: linear-gradient(135deg, rgba(205,127,50,0.1) 0%, rgba(205,127,50,0.03) 100%);
            border-color: rgba(205,127,50,0.2);
        }
        
        .podium-medal {
            font-size: 80px;
        }
        
        .podium-info {
            flex: 1;
        }
        
        .podium-name {
            font-size: 42px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .podium-stats {
            font-size: 24px;
            color: rgba(255,255,255,0.6);
        }
        
        .podium-elo {
            font-size: 48px;
            font-weight: 700;
            color: #00f3ff;
        }
        
        /* Highlights Story Styles */
        .highlights-container {
            display: flex;
            flex-direction: column;
            gap: 50px;
            width: 100%;
            max-width: 900px;
            margin-top: 60px;
        }
        
        .highlight-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 50px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .highlight-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent-color), transparent);
        }
        
        .highlight-emoji {
            font-size: 100px;
            margin-bottom: 20px;
        }
        
        .highlight-title {
            font-size: 32px;
            color: rgba(255,255,255,0.6);
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        
        .highlight-player {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 15px;
        }
        
        .highlight-value {
            font-size: 72px;
            font-weight: 900;
            color: var(--accent-color);
            text-shadow: 0 0 30px var(--accent-color);
        }
        
        .highlight-desc {
            font-size: 28px;
            color: rgba(255,255,255,0.5);
            margin-top: 15px;
        }
        
        /* Footer */
        .story-footer {
            position: absolute;
            bottom: 80px;
            font-size: 24px;
            color: rgba(255,255,255,0.3);
            letter-spacing: 2px;
        }
    `;
}

// =============================================================================
// STORY HTML GENERATORS
// =============================================================================

/**
 * Generate Story 1: Champion Spotlight
 */
function generateChampionHTML(player: Player | AggregatedPlayer, gameName: string): string {
    const winRate = calculateWinRate(player.wins, player.losses, player.draws);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${getStoryStyles()}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="branding">Game of S.T.I.C.K.</div>
            <div class="game-name">${gameName}</div>
            
            <div class="champion-medal">🥇</div>
            <div class="champion-name">${player.name}</div>
            <div class="champion-elo">${player.elo} <span>ELO</span></div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value wins">${player.wins}</div>
                    <div class="stat-label">Wins</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value losses">${player.losses}</div>
                    <div class="stat-label">Losses</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value draws">${player.draws}</div>
                    <div class="stat-label">Draws</div>
                </div>
            </div>
            
            <div class="win-rate">${winRate}% <span>WIN RATE</span></div>
            
            <div class="story-footer">🏆 THE CHAMPION</div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generate Story 2: Podium View
 */
function generatePodiumHTML(players: (Player | AggregatedPlayer)[], gameName: string): string {
    const top3 = players.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['gold', 'silver', 'bronze'];

    const podiumCards = top3.map((p, i) => {
        const winRate = calculateWinRate(p.wins, p.losses, p.draws);
        return `
            <div class="podium-card ${classes[i]}">
                <div class="podium-medal">${medals[i]}</div>
                <div class="podium-info">
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-stats">${p.wins}W / ${p.losses}L • ${winRate}% win rate</div>
                </div>
                <div class="podium-elo">${p.elo}</div>
            </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${getStoryStyles()}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="branding">Game of S.T.I.C.K.</div>
            <div class="game-name">${gameName}</div>
            
            <div class="section-title">🏆 THE PODIUM</div>
            
            <div class="podium-container">
                ${podiumCards}
            </div>
            
            <div class="story-footer">TOP 3 PLAYERS</div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generate Story 3: Match Highlights
 */
function generateHighlightsHTML(
    highlights: StoryHighlight[],
    gameName: string
): string {
    const accentColors: Record<string, string> = {
        streak: '#FF6B35',
        elo_gain: '#00f3ff',
        upset: '#9370DB',
    };

    const titles: Record<string, string> = {
        streak: '🔥 BIGGEST STREAK',
        elo_gain: '⚡ BIGGEST WIN',
        upset: '💀 BIGGEST UPSET',
    };

    const highlightCards = highlights.slice(0, 2).map(h => `
        <div class="highlight-card" style="--accent-color: ${accentColors[h.type]}">
            <div class="highlight-emoji">${h.emoji}</div>
            <div class="highlight-title">${titles[h.type]}</div>
            <div class="highlight-player">${h.playerName}</div>
            <div class="highlight-value">${h.type === 'streak' ? h.value + ' WINS' : '+' + h.value}</div>
            ${h.opponent ? `<div class="highlight-desc">vs ${h.opponent}</div>` : ''}
        </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${getStoryStyles()}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="branding">Game of S.T.I.C.K.</div>
            <div class="game-name">${gameName}</div>
            
            <div class="section-title">⚡ MATCH SPOTLIGHT</div>
            
            <div class="highlights-container">
                ${highlightCards}
            </div>
            
            <div class="story-footer">BEST MOMENTS</div>
        </div>
    </body>
    </html>
    `;
}

// =============================================================================
// CORE EXPORT FUNCTIONS
// =============================================================================

/**
 * Render HTML to canvas and convert to PNG blob
 */
async function htmlToImageBlob(html: string): Promise<Blob> {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Wait for fonts to load
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 100));

    const storyElement = container.querySelector('#story') as HTMLElement;

    const canvas = await html2canvas(storyElement, {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
    });

    document.body.removeChild(container);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to generate image blob'));
            }
        }, 'image/png', 1.0);
    });
}

/**
 * Download a blob as an image file
 */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate and download Instagram stories for a single game
 */
export async function generateGameInstagramStories(
    players: Player[],
    matches: Match[],
    gameName: string
): Promise<void> {
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

    if (sortedPlayers.length === 0) {
        console.warn('No players to generate stories for');
        return;
    }

    // Story 1: Champion
    const championHtml = generateChampionHTML(sortedPlayers[0], gameName);
    const championBlob = await htmlToImageBlob(championHtml);
    downloadBlob(championBlob, `${gameName.toLowerCase().replace(/\s+/g, '-')}-story-1-champion.png`);

    // Story 2: Podium
    if (sortedPlayers.length >= 3) {
        const podiumHtml = generatePodiumHTML(sortedPlayers, gameName);
        const podiumBlob = await htmlToImageBlob(podiumHtml);
        downloadBlob(podiumBlob, `${gameName.toLowerCase().replace(/\s+/g, '-')}-story-2-podium.png`);
    }

    // Story 3: Highlights
    const highlights: StoryHighlight[] = [];

    const streakHighlight = findBiggestWinStreak(sortedPlayers);
    if (streakHighlight) highlights.push(streakHighlight);

    const eloGainHighlight = findBiggestEloGain(matches);
    if (eloGainHighlight) highlights.push(eloGainHighlight);

    const upsetHighlight = findBiggestUpset(matches);
    if (upsetHighlight && highlights.length < 2) highlights.push(upsetHighlight);

    if (highlights.length > 0) {
        const highlightsHtml = generateHighlightsHTML(highlights, gameName);
        const highlightsBlob = await htmlToImageBlob(highlightsHtml);
        downloadBlob(highlightsBlob, `${gameName.toLowerCase().replace(/\s+/g, '-')}-story-3-highlights.png`);
    }
}

/**
 * Generate and download Instagram stories for aggregated stats
 */
export async function generateAggregatedInstagramStories(
    stats: AggregatedStats,
    segmentLabel: string
): Promise<void> {
    const { players, matches } = stats;
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

    if (sortedPlayers.length === 0) {
        console.warn('No players to generate stories for');
        return;
    }

    const safeName = segmentLabel.toLowerCase().replace(/\s+/g, '-');

    // Story 1: Champion
    const championHtml = generateChampionHTML(sortedPlayers[0], segmentLabel);
    const championBlob = await htmlToImageBlob(championHtml);
    downloadBlob(championBlob, `${safeName}-story-1-champion.png`);

    // Story 2: Podium
    if (sortedPlayers.length >= 3) {
        const podiumHtml = generatePodiumHTML(sortedPlayers, segmentLabel);
        const podiumBlob = await htmlToImageBlob(podiumHtml);
        downloadBlob(podiumBlob, `${safeName}-story-2-podium.png`);
    }

    // Story 3: Highlights (ELO gain + upset for aggregated)
    const highlights: StoryHighlight[] = [];

    const eloGainHighlight = findBiggestEloGain(matches);
    if (eloGainHighlight) highlights.push(eloGainHighlight);

    const upsetHighlight = findBiggestUpset(matches);
    if (upsetHighlight) highlights.push(upsetHighlight);

    if (highlights.length > 0) {
        const highlightsHtml = generateHighlightsHTML(highlights, segmentLabel);
        const highlightsBlob = await htmlToImageBlob(highlightsHtml);
        downloadBlob(highlightsBlob, `${safeName}-story-3-highlights.png`);
    }
}
