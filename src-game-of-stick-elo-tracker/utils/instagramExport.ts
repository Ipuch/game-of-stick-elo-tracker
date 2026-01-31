/**
 * Instagram Story Export utility for Game of STICK
 * Generates 1080x1920 (9:16) story images for Instagram
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AggregatedPlayer, AggregatedStats } from './aggregationUtils';
import { calculateWinRate } from './statsUtils';
import html2canvas from 'html2canvas';
import { t, formatDate } from './i18n';
import { 
    StoryHighlight, 
    findBiggestWinStreak, 
    findBiggestEloGain, 
    findBiggestUpset 
} from './storyHighlights';

// Re-export for backwards compatibility
export { findBiggestWinStreak, findBiggestEloGain, findBiggestUpset };
export type { StoryHighlight };

// @ts-ignore - Import png to ensure bundle inclusion
import WcaLogo from '../Logo-west-coast-academy02.png';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

// =============================================================================
// SHARED STYLES
// =============================================================================

// =============================================================================
// SHARED STYLES
// =============================================================================

// =============================================================================
// SHARED STYLES & THEMES
// =============================================================================

type Theme = 'neon' | 'cholet';

function getStyles(theme: Theme): string {
    if (theme === 'cholet') {
        return getCholetStyles();
    }
    return getNeonStyles();
}

function getNeonStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Outfit:wght@300;400;600;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --neon-blue: #00f3ff;
            --neon-pink: #ff00ff;
            --neon-purple: #bc13fe;
            --neon-gold: #ffd700;
            --bg-dark: #050510;
            --card-bg: rgba(255, 255, 255, 0.03);
            --card-border: rgba(255, 255, 255, 0.1);
        }

        .story-container {
            width: ${STORY_WIDTH}px;
            height: ${STORY_HEIGHT}px;
            background: radial-gradient(circle at 50% 0%, #1a1a3a 0%, #050510 60%);
            font-family: 'Outfit', sans-serif;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 100px 60px;
            position: relative;
            overflow: hidden;
        }

        .bg-glow {
            position: absolute;
            width: 800px;
            height: 800px;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.2;
            z-index: 0;
        }
        .bg-glow-1 { top: -200px; left: -200px; background: var(--neon-blue); }
        .bg-glow-2 { bottom: -200px; right: -200px; background: var(--neon-purple); }
        
        .bg-grid {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: 
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 50px 50px;
            z-index: 0;
            mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
        }

        .content-layer {
            position: relative;
            z-index: 10;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .logo-container {
            margin-bottom: 30px;
        }
        .wca-logo {
            height: 120px;
            filter: drop-shadow(0 0 15px rgba(0, 243, 255, 0.5));
        }

        .branding {
            font-family: 'Orbitron', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: rgba(255,255,255,0.5);
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .game-name {
            font-family: 'Orbitron', sans-serif;
            font-size: 42px;
            font-weight: 900;
            color: #fff;
            margin-bottom: 60px;
            text-align: center;
            text-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
            letter-spacing: 2px;
        }

        .story-footer {
            position: absolute;
            bottom: 80px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }

        .footer-tag {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px;
            font-weight: 700;
            color: var(--neon-blue);
            text-transform: uppercase;
            letter-spacing: 4px;
            text-shadow: 0 0 15px var(--neon-blue);
        }

        .footer-date {
            font-size: 20px;
            color: rgba(255,255,255,0.4);
            font-weight: 300;
        }

        .glass-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 30px;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        }

        /* CHAMPION */
        .champion-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            max-width: 900px;
            padding: 80px 40px;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 215, 0, 0.3);
            background: linear-gradient(180deg, rgba(255,215,0,0.05) 0%, rgba(0,0,0,0) 100%);
        }
        .champion-card::before {
            content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: linear-gradient(45deg, transparent, rgba(255,215,0,0.1), transparent);
            animation: shine 3s infinite;
        }
        .champion-rank {
            font-family: 'Orbitron', sans-serif;
            font-size: 200px;
            font-weight: 900;
            line-height: 1;
            background: linear-gradient(180deg, #ffd700 0%, #d4af37 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: -20px;
            filter: drop-shadow(0 10px 20px rgba(255,215,0,0.3));
        }
        .champion-title {
            font-size: 36px; color: #ffd700; letter-spacing: 4px; margin-bottom: 40px; text-transform: uppercase;
        }
        .champion-name {
            font-size: 80px; font-weight: 800; margin-bottom: 20px; text-align: center; line-height: 1.1;
        }
        .champion-elo-box {
            background: rgba(0,0,0,0.4); border: 1px solid rgba(255,215,0,0.3); padding: 15px 40px;
            border-radius: 50px; margin-bottom: 60px; display: flex; align-items: baseline; gap: 10px;
        }
        .champion-elo-val { font-family: 'Orbitron', sans-serif; font-size: 64px; font-weight: 700; color: #fff; }
        .champion-elo-label { font-size: 24px; color: rgba(255,255,255,0.5); font-weight: 600; }
        
        .stats-row {
            display: flex; justify-content: space-between; width: 100%; gap: 20px; margin-top: 20px;
        }
        .mini-stat {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            background: rgba(255,255,255,0.05); border-radius: 20px; padding: 25px 10px;
        }
        .mini-stat-val { font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 700; margin-bottom: 5px; }
        .mini-stat-label { font-size: 16px; text-transform: uppercase; color: rgba(255,255,255,0.5); letter-spacing: 1px; }
        
        .val-win { color: #4caf50; }
        .val-loss { color: #f44336; }
        .val-rate { color: var(--neon-blue); }

        /* PODIUM */
        .podium-stack { display: flex; flex-direction: column; gap: 30px; width: 100%; max-width: 950px; margin-top: 40px; }
        .podium-entry {
            display: flex; align-items: center; background: var(--card-bg);
            border: 1px solid var(--card-border); border-radius: 24px; padding: 30px 40px; gap: 30px; position: relative;
        }
        .podium-entry.gold {
            background: linear-gradient(90deg, rgba(255,215,0,0.1), transparent);
            border-color: rgba(255,215,0,0.4); transform: scale(1.05); box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 2;
        }
        .podium-entry.silver { border-color: rgba(192,192,192,0.3); }
        .podium-entry.bronze { border-color: rgba(205,127,50,0.3); }
        
        .rank-badge {
            font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 900; width: 80px; height: 80px;
            display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.1);
        }
        .gold .rank-badge { background: #ffd700; color: #000; box-shadow: 0 0 20px rgba(255,215,0,0.4); }
        .silver .rank-badge { background: #c0c0c0; color: #000; }
        .bronze .rank-badge { background: #cd7f32; color: #000; }
        
        .entry-info { flex: 1; }
        .entry-name { font-size: 48px; font-weight: 700; margin-bottom: 5px; }
        .entry-detail { font-size: 24px; color: rgba(255,255,255,0.6); }
        .entry-elo { text-align: right; }
        .elo-big { font-family: 'Orbitron', sans-serif; font-size: 56px; font-weight: 700; color: #fff; }
        .elo-label { font-size: 18px; color: rgba(255,255,255,0.4); text-transform: uppercase; }

        /* HIGHLIGHTS */
        .highlights-grid { display: grid; grid-template-columns: 1fr; gap: 50px; width: 100%; max-width: 900px; margin-top: 20px; }
        .hl-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
            border: 1px solid rgba(255,255,255,0.1); border-radius: 40px; padding: 50px;
            display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden;
        }
        .hl-card::before {
            content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 6px;
            background: var(--hl-color, #fff); box-shadow: 0 0 20px var(--hl-color, #fff);
        }
        .hl-icon {
            font-size: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 15px rgba(255,255,255,0.2));
            background: rgba(255,255,255,0.05); width: 140px; height: 140px;
            display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1);
        }
        .hl-label {
            font-family: 'Orbitron', sans-serif; font-size: 28px; color: var(--hl-color);
            text-transform: uppercase; letter-spacing: 4px; margin-bottom: 20px;
        }
        .hl-player { font-size: 64px; font-weight: 800; margin-bottom: 15px; line-height: 1; }
        .hl-value {
            font-family: 'Orbitron', sans-serif; font-size: 100px; font-weight: 900;
            color: #fff; text-shadow: 0 0 30px var(--hl-color); margin-bottom: 10px; line-height: 1;
        }
        .hl-sub { font-size: 28px; color: rgba(255,255,255,0.6); max-width: 80%; line-height: 1.4; }
    `;
}

function getCholetStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Alata&family=Jost:wght@400;500;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            /* Extracted from WCA Cholet CSS */
            --cholet-red: rgb(204, 16, 21);
            --cholet-red-dark: rgb(179, 33, 46);
            --cholet-text-dark: rgb(33, 33, 33);
            --cholet-bg: #ffffff;
            --cholet-grey-light: #f4f4f4;
        }

        .story-container {
            width: ${STORY_WIDTH}px;
            height: ${STORY_HEIGHT}px;
            background: var(--cholet-bg);
            /* Subtle texture pattern to mimic 'motif01.png' */
            background-image: 
                radial-gradient(circle at 100% 50%, transparent 20%, rgba(204,16,21,0.03) 21%, rgba(204,16,21,0.03) 34%, transparent 35%, transparent),
                radial-gradient(circle at 0% 50%, transparent 20%, rgba(204,16,21,0.03) 21%, rgba(204,16,21,0.03) 34%, transparent 35%, transparent);
            background-size: 100px 100px;
            font-family: 'Jost', sans-serif;
            color: var(--cholet-text-dark);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 80px 60px;
            position: relative;
            overflow: hidden;
        }
        
        /* Top Red Line */
        .story-container::before {
            content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 24px;
            background: var(--cholet-red);
        }

        .content-layer {
            position: relative; z-index: 10; width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center;
        }

        .logo-container { 
            margin-bottom: 30px; 
            display: flex;
            justify-content: center;
            align-items: center;
            /* Dark circular background to make white logo visible */
            background: var(--cholet-red);
            border-radius: 50%;
            padding: 20px 30px;
            box-shadow: 0 5px 20px rgba(204, 16, 21, 0.3);
        }
        .wca-logo { 
            height: 100px;
            width: auto;
            display: block;
            /* Simple drop shadow - no complex filters */
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        } 

        .branding {
            font-family: 'Alata', sans-serif;
            font-size: 20px; 
            text-transform: uppercase; 
            color: var(--cholet-text-dark);
            letter-spacing: 2px;
            margin-bottom: 10px;
            opacity: 0.7;
        }
        
        .game-name {
            font-family: 'Alata', sans-serif;
            font-size: 48px; 
            /* Red color for main headers as per CSS .wt-container-9408621 */
            color: var(--cholet-red-dark);
            text-transform: uppercase;
            margin-bottom: 50px; 
            text-align: center; 
            font-weight: 400; /* Alata is 400 */
        }

        .story-footer {
            position: absolute; bottom: 80px; display: flex; flex-direction: column; align-items: center; gap: 5px;
        }
        .footer-tag {
            font-family: 'Alata', sans-serif;
            font-size: 32px; 
            color: var(--cholet-red);
            text-transform: uppercase; 
        }
        .footer-date { font-size: 20px; color: #666; font-weight: 500; }

        .glass-card {
            background: #fff; border-radius: 40px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.08); /* Softer shadow */
            border: 1px solid #eaeaea;
        }

        /* CHAMPION */
        .champion-card {
            display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 900px;
            padding: 80px 40px; position: relative; overflow: hidden;
        }
        .champion-rank {
            font-family: 'Alata', sans-serif;
            font-size: 220px; line-height: 0.8; color: var(--cholet-red);
            margin-bottom: 10px;
        }
        .champion-title {
            font-family: 'Jost', sans-serif;
            font-size: 32px; font-weight: 700; color: var(--cholet-text-dark);
            text-transform: uppercase; letter-spacing: 4px; margin-bottom: 30px;
        }
        .champion-name {
            font-family: 'Alata', sans-serif;
            font-size: 72px; margin-bottom: 30px; text-align: center; color: var(--cholet-text-dark);
        }
        .champion-elo-box {
            background: var(--cholet-red); color: #fff; padding: 15px 50px;
            border-radius: 50px; margin-bottom: 60px; display: flex; align-items: baseline; gap: 10px;
            box-shadow: 0 5px 15px rgba(204, 16, 21, 0.3);
        }
        .champion-elo-val { 
            font-family: 'Jost', sans-serif; font-size: 64px; font-weight: 700; 
        }
        .champion-elo-label { font-size: 20px; opacity: 0.9; font-weight: 500; text-transform: uppercase; }
        
        .stats-row { display: flex; justify-content: space-between; width: 100%; gap: 20px; margin-top: 20px; }
        .mini-stat {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            background: var(--cholet-grey-light); border-radius: 20px; padding: 25px 10px;
        }
        .mini-stat-val { 
            font-family: 'Jost', sans-serif; font-size: 48px; font-weight: 700; margin-bottom: 5px; color: var(--cholet-text-dark); 
        }
        .mini-stat-label { font-family: 'Alata', sans-serif; font-size: 14px; text-transform: uppercase; color: #666; }
        
        .val-win { color: #2e7d32; }
        .val-loss { color: #c62828; }
        .val-rate { color: var(--cholet-red); }

        /* PODIUM */
        .podium-stack { display: flex; flex-direction: column; gap: 25px; width: 100%; max-width: 950px; margin-top: 40px; }
        .podium-entry {
            display: flex; align-items: center; background: #fff;
            border: 1px solid #eee; border-radius: 20px; padding: 25px 40px; gap: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.03);
            font-family: 'Jost', sans-serif;
        }
        .podium-entry.gold {
            border: 2px solid #ffd700; transform: scale(1.02); box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        .podium-entry.silver { border-left: 8px solid #c0c0c0; }
        .podium-entry.bronze { border-left: 8px solid #cd7f32; }
        
        .rank-badge {
            font-family: 'Alata', sans-serif;
            font-size: 42px; width: 70px; height: 70px;
            display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #f0f0f0;
        }
        .gold .rank-badge { background: #ffd700; color: #fff; }
        .silver .rank-badge { background: #c0c0c0; color: #fff; }
        .bronze .rank-badge { background: #cd7f32; color: #fff; }
        
        .entry-info { flex: 1; }
        .entry-name { 
            font-family: 'Alata', sans-serif; font-size: 42px; margin-bottom: 5px; color: var(--cholet-text-dark); 
        }
        .entry-detail { font-size: 22px; color: #666; font-weight: 500; }
        .entry-elo { text-align: right; }
        .elo-big { 
            font-family: 'Jost', sans-serif; font-size: 48px; font-weight: 700; color: var(--cholet-red); 
        }
        .elo-label { font-size: 16px; color: #999; text-transform: uppercase; font-weight: 700; }

        /* HIGHLIGHTS */
        .highlights-grid { display: grid; grid-template-columns: 1fr; gap: 40px; width: 100%; max-width: 900px; margin-top: 20px; }
        .hl-card {
            background: #fff; border: 1px solid #eee; border-radius: 30px; padding: 50px;
            display: flex; flex-direction: column; align-items: center; text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-top: 8px solid var(--hl-color);
        }
        .hl-icon {
            font-size: 80px; margin-bottom: 20px; background: var(--cholet-grey-light); width: 140px; height: 140px;
            display: flex; align-items: center; justify-content: center; border-radius: 50%;
        }
        .hl-label {
            font-family: 'Alata', sans-serif;
            font-size: 24px; color: var(--hl-color); text-transform: uppercase;
            letter-spacing: 1px; margin-bottom: 15px;
        }
        .hl-player { 
            font-family: 'Jost', sans-serif; font-size: 56px; font-weight: 700; margin-bottom: 15px; line-height: 1; color: var(--cholet-text-dark); 
        }
        .hl-value {
            font-family: 'Jost', sans-serif; font-size: 90px; font-weight: 800; color: var(--cholet-red); margin-bottom: 10px; line-height: 1;
        }
        .hl-sub { font-size: 24px; color: #666; max-width: 80%; font-weight: 400; }
    `;
}

// =============================================================================
// STORY HTML GENERATORS
// =============================================================================

// =============================================================================
// HELPERS
// =============================================================================

// function deleted

// =============================================================================
// STORY HTML GENERATORS
// =============================================================================

/**
 * Generate Story 1: Champion Spotlight
 */
function generateChampionHTML(player: Player | AggregatedPlayer, gameName: string, theme: Theme, logoBase64: string): string {
    const winRate = calculateWinRate(player.wins, player.losses, player.draws);
    const dateStr = formatDate(new Date());
    const styles = getStyles(theme);

    const logoHtml = logoBase64 ? `<div class="logo-container"><img src="${logoBase64}" class="wca-logo" /></div>` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${styles}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="bg-glow bg-glow-1"></div>
            <div class="bg-glow bg-glow-2"></div>
            <div class="bg-grid"></div>

            <div class="content-layer">
                ${logoHtml}
                <div class="branding">Game of STICK</div>
                <div class="game-name">${gameName}</div>
                
                <div class="glass-card champion-card">
                    <div class="champion-rank">1</div>
                    <div class="champion-title">${t('stories.theChampion')}</div>
                    <div class="champion-name">${player.name}</div>
                    
                    <div class="champion-elo-box">
                        <span class="champion-elo-val">${player.elo}</span>
                        <span class="champion-elo-label">${t('stories.eloRating')}</span>
                    </div>
                    
                    <div class="stats-row">
                        <div class="mini-stat">
                            <span class="mini-stat-val val-win">${player.wins}</span>
                            <span class="mini-stat-label">${t('stories.wins')}</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-val val-rate">${winRate}%</span>
                            <span class="mini-stat-label">${t('stories.winRate')}</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-val val-loss">${player.losses}</span>
                            <span class="mini-stat-label">${t('stories.losses')}</span>
                        </div>
                    </div>
                </div>

                <div class="story-footer">
                    <div class="footer-tag">${t('stories.currentMeta')}</div>
                    <div class="footer-date">${dateStr}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generate Story 2: Podium View
 */
function generatePodiumHTML(players: (Player | AggregatedPlayer)[], gameName: string, theme: Theme, logoBase64: string): string {
    const top3 = players.slice(0, 3);
    const dateStr = formatDate(new Date());
    const classes = ['gold', 'silver', 'bronze'];
    const styles = getStyles(theme);

    const logoHtml = logoBase64 ? `<div class="logo-container"><img src="${logoBase64}" class="wca-logo" /></div>` : '';

    const podiumEntries = top3.map((p, i) => {
        const winRate = calculateWinRate(p.wins, p.losses, p.draws);
        return `
            <div class="podium-entry ${classes[i]}">
                <div class="rank-badge">${i + 1}</div>
                <div class="entry-info">
                    <div class="entry-name">${p.name}</div>
                    <div class="entry-detail">${p.wins} ${t('stories.wins')} • ${winRate}% ${t('common.winRate')}</div>
                </div>
                <div class="entry-elo">
                    <div class="elo-big">${p.elo}</div>
                    <div class="elo-label">ELO</div>
                </div>
            </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${styles}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="bg-glow bg-glow-1"></div>
            <div class="bg-glow bg-glow-2"></div>
            <div class="bg-grid"></div>

            <div class="content-layer">
                ${logoHtml}
                <div class="branding">Game of STICK</div>
                <div class="game-name">${gameName}</div>
                
                <div class="podium-stack">
                    ${podiumEntries}
                </div>

                <div class="story-footer">
                    <div class="footer-tag">${t('stories.leaderboard')}</div>
                    <div class="footer-date">${dateStr}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generate Story 3: Match Highlights
 */
function generateHighlightsHTML(highlights: StoryHighlight[], gameName: string, theme: Theme, logoBase64: string): string {
    const dateStr = formatDate(new Date());
    const styles = getStyles(theme);

    // Map highlight types to colors
    const colors: Record<string, string> = {
        streak: '#ff6b35', // Orange
        elo_gain: '#00f3ff', // Cyan
        upset: '#bc13fe', // Purple
    };

    const labels: Record<string, string> = {
        streak: t('stories.unstoppable'),
        elo_gain: t('stories.skyrocketing'),
        upset: t('stories.underdogWin'),
    };

    // Cholet specific colors overrides (if needed, but usually CSS var handles main things, 
    // these are for the dynamic JS parts)
    if (theme === 'cholet') {
        colors.streak = '#E60000';
        colors.elo_gain = '#003399';
        colors.upset = '#333';
    }

    const logoHtml = logoBase64 ? `<div class="logo-container"><img src="${logoBase64}" class="wca-logo" /></div>` : '';
    const validHighlights = highlights.slice(0, 2);

    const cards = validHighlights.map(h => `
        <div class="hl-card" style="--hl-color: ${colors[h.type]}">
            <div class="hl-icon">${h.emoji}</div>
            <div class="hl-label">${labels[h.type]}</div>
            <div class="hl-player">${h.playerName}</div>
            <div class="hl-value">
                ${h.type === 'streak' ? h.value : (h.type === 'elo_gain' ? '+' + h.value : h.value + '%')}
            </div>
            <div class="hl-sub">
                ${h.type === 'streak' ? t('stories.consecutiveWins') : (h.type === 'elo_gain' ? t('stories.pointsInOneMatch') : t('stories.winProbability'))}
                ${h.opponent ? `<br><span style="font-size: 0.8em; opacity: 0.7">${t('stories.vs')} ${h.opponent}</span>` : ''}
            </div>
        </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>${styles}</style>
    </head>
    <body>
        <div class="story-container" id="story">
            <div class="bg-glow bg-glow-1"></div>
            <div class="bg-glow bg-glow-2"></div>
            <div class="bg-grid"></div>

            <div class="content-layer">
                ${logoHtml}
                <div class="branding">Game of STICK</div>
                <div class="game-name">${gameName}</div>
                
                <div class="highlights-grid">
                    ${cards}
                </div>

                <div class="story-footer">
                    <div class="footer-tag">${t('stories.topMoments')}</div>
                    <div class="footer-date">${dateStr}</div>
                </div>
            </div>
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
// =============================================================================
// HELPERS
// =============================================================================

async function loadLogoAsBase64(): Promise<string> {
    try {
        const response = await fetch(WcaLogo);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('Failed to load logo', e);
        // Return transparent pixel as fallback to avoid broken image icon
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
}

// =============================================================================
// CORE EXPORT FUNCTIONS
// =============================================================================

/**
 * Render HTML to canvas and convert to PNG blob
 */
async function htmlToImageBlob(html: string): Promise<Blob> {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    await document.fonts.ready;

    // Improved image waiter
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
        });
    }));

    // Small buffer
    await new Promise(resolve => setTimeout(resolve, 200));

    const storyElement = container.querySelector('#story') as HTMLElement;

    const canvas = await html2canvas(storyElement, {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
        logging: false,
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

    // Load logo as Base64 to ensure html2canvas captures it
    const logoBase64 = await loadLogoAsBase64();
    const themes: Theme[] = ['neon', 'cholet'];

    for (const theme of themes) {
        const filePrefix = `${gameName.toLowerCase().replace(/\s+/g, '-')}-${theme}`;

        const championHtml = generateChampionHTML(sortedPlayers[0], gameName, theme, logoBase64);
        const championBlob = await htmlToImageBlob(championHtml);
        downloadBlob(championBlob, `${filePrefix}-story-1-champion.png`);

        if (sortedPlayers.length >= 3) {
            const podiumHtml = generatePodiumHTML(sortedPlayers, gameName, theme, logoBase64);
            const podiumBlob = await htmlToImageBlob(podiumHtml);
            downloadBlob(podiumBlob, `${filePrefix}-story-2-podium.png`);
        }

        const highlights: StoryHighlight[] = [];
        const streakHighlight = findBiggestWinStreak(sortedPlayers);
        if (streakHighlight) highlights.push(streakHighlight);
        const eloGainHighlight = findBiggestEloGain(matches);
        if (eloGainHighlight) highlights.push(eloGainHighlight);
        const upsetHighlight = findBiggestUpset(matches);
        if (upsetHighlight && highlights.length < 2) highlights.push(upsetHighlight);

        if (highlights.length > 0) {
            const highlightsHtml = generateHighlightsHTML(highlights, gameName, theme, logoBase64);
            const highlightsBlob = await htmlToImageBlob(highlightsHtml);
            downloadBlob(highlightsBlob, `${filePrefix}-story-3-highlights.png`);
        }
    }
}

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

    const logoBase64 = await loadLogoAsBase64();
    const themes: Theme[] = ['neon', 'cholet'];
    const safeName = segmentLabel.toLowerCase().replace(/\s+/g, '-');

    for (const theme of themes) {
        const filePrefix = `${safeName}-${theme}`;

        const championHtml = generateChampionHTML(sortedPlayers[0], segmentLabel, theme, logoBase64);
        const championBlob = await htmlToImageBlob(championHtml);
        downloadBlob(championBlob, `${filePrefix}-story-1-champion.png`);

        if (sortedPlayers.length >= 3) {
            const podiumHtml = generatePodiumHTML(sortedPlayers, segmentLabel, theme, logoBase64);
            const podiumBlob = await htmlToImageBlob(podiumHtml);
            downloadBlob(podiumBlob, `${filePrefix}-story-2-podium.png`);
        }

        const highlights: StoryHighlight[] = [];
        const eloGainHighlight = findBiggestEloGain(matches);
        if (eloGainHighlight) highlights.push(eloGainHighlight);
        const upsetHighlight = findBiggestUpset(matches);
        if (upsetHighlight) highlights.push(upsetHighlight);

        if (highlights.length > 0) {
            const highlightsHtml = generateHighlightsHTML(highlights, segmentLabel, theme, logoBase64);
            const highlightsBlob = await htmlToImageBlob(highlightsHtml);
            downloadBlob(highlightsBlob, `${filePrefix}-story-3-highlights.png`);
        }
    }
}
