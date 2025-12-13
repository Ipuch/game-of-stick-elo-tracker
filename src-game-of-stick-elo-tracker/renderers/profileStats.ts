import { Player, Match } from '../types/appTypes';
import { INITIAL_ELO } from '../constants/appConstants';

function renderStreak(type: 'W' | 'L' | null, length: number): string {
    if (length < 3 || !type) return '';

    let emoji = '';
    if (type === 'W') {
        emoji = '🔥'.repeat(Math.floor(length / 3));
    } else {
        emoji = '🧊'.repeat(Math.floor(length / 3));
    }

    return `<span class="streak-indicator">${emoji} ${type}${length}</span>`;
}

export function renderProfileStatsSection(players: Player[], matchHistory: Match[]) {
    // Move the toggle button outside the section
    let section = document.getElementById('profile-stats-section');
    if (!section) return;

    // Remove any existing external toggle button
    let externalToggleBtn = document.getElementById('profile-stats-toggle-btn') as HTMLButtonElement | null;
    if (externalToggleBtn) externalToggleBtn.remove();

    // Create and insert the toggle button before the section
    externalToggleBtn = document.createElement('button');
    externalToggleBtn.id = 'profile-stats-toggle-btn';
    externalToggleBtn.className = 'button-secondary profile-toggle-btn';
    externalToggleBtn.textContent = section.style.display === 'none' ? 'Show Profile Stats' : 'Hide Profile Stats';
    section.parentNode?.insertBefore(externalToggleBtn, section);
    externalToggleBtn.addEventListener('click', () => {
        if (section.style.display === 'none') {
            section.style.display = '';
            externalToggleBtn.textContent = 'Hide Profile Stats';
        } else {
            section.style.display = 'none';
            externalToggleBtn.textContent = 'Show Profile Stats';
        }
    });

    // Player select
    let select = document.getElementById('profile-stats-select') as HTMLSelectElement | null;
    if (!select) {
        select = document.createElement('select');
        select.id = 'profile-stats-select';
        section.insertBefore(select, section.querySelector('h2')?.nextSibling ?? section.firstChild);
    }

    // Always ensure the change event listener is attached
    if (select) {
        // We need to manage event listeners to avoid duplication if this is called multiple times without clearing
        // But logically render() replaces the innerHTML or re-runs this. 
        // The previous code added a listener every time render was called? 
        // Checked original: yes, "it's safe to add multiple, they'll all work" - actually valid for 'change' if elements are recreated, but here select is reused.
        // However, recreating the select or ensuring single listener is better.
        // To match original behavior exactly for now (as per "safe" comment in original), I'll invoke content render directly.

        // Better refactor: remove old listener if possible, but we can't easily. 
        // Instead, let's clone the node or just set onchange property.
        select.onchange = () => {
            renderProfileStatsContent(select!.value, players, matchHistory);
        };
    }
    // Populate options
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = '';
    sortedPlayers.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });

    // Guarantee valid selection - always reset to first player when repopulating
    if (sortedPlayers.length > 0) {
        select.value = sortedPlayers[0].id;
        renderProfileStatsContent(sortedPlayers[0].id, players, matchHistory);
    } else {
        const content = document.getElementById('profile-stats-content');
        if (content) content.innerHTML = '<p>No players.</p>';
    }
}

function renderProfileStatsContent(playerId: string, players: Player[], matchHistory: Match[]) {
    const content = document.getElementById('profile-stats-content');
    if (!content) return;

    const player = players.find(p => p.id === playerId);
    if (!player) {
        content.innerHTML = '<p>No player selected.</p>';
        return;
    }

    // Get ELO evolution data
    const playerMatches = matchHistory
        .filter(m => m.player1Id === player.id || m.player2Id === player.id)
        .sort((a, b) => a.timestamp - b.timestamp);

    let currentElo = INITIAL_ELO;
    const eloHistory = [currentElo];

    playerMatches.forEach(match => {
        const isP1 = match.player1Id === player.id;
        if (isP1) {
            currentElo = match.player1EloAfter;
        } else {
            currentElo = match.player2EloAfter;
        }
        eloHistory.push(currentElo);
    });

    // Create SVG graph
    const svgWidth = 120;
    const svgHeight = 40;
    const padding = 4;
    const graphWidth = svgWidth - 2 * padding;
    const graphHeight = svgHeight - 2 * padding;

    let svgPath = '';
    if (eloHistory.length > 1) {
        const minElo = Math.min(...eloHistory);
        const maxElo = Math.max(...eloHistory);
        const eloRange = maxElo - minElo || 1;

        const points = eloHistory.map((elo, index) => {
            const x = padding + (index / (eloHistory.length - 1)) * graphWidth;
            const y = padding + graphHeight - ((elo - minElo) / eloRange) * graphHeight;
            return `${x},${y}`;
        });

        svgPath = `M ${points.join(' L ')}`;
    } else {
        // Single point - draw a horizontal line
        svgPath = `M ${padding},${svgHeight / 2} L ${svgWidth - padding},${svgHeight / 2}`;
    }


    // Get player rank
    const sortedByElo = [...players].sort((a, b) => b.elo - a.elo);
    const rank = sortedByElo.findIndex(p => p.id === player.id) + 1;
    // Stats (one line) with graph
    let streakHtml = '';
    if (player.currentStreakType === 'W' && player.currentStreakLength >= 2) {
        streakHtml = `| <span class='win-streak'>Win Streak: <span title='Win Streak'>🔥${player.currentStreakLength}</span></span>`;
    }
    if (player.currentStreakType === 'L' && player.currentStreakLength >= 2) {
        streakHtml = `| <span class='loss-streak'>Loss Streak: <span title= Loss Streak'>🧊${player.currentStreakLength}</span></span>`;
    }

    let html = `
    <div class="profile-stats-header">
        <div class="profile-stats-info">
            <span class='rank-number'>#${rank}</span> 
            <strong>${player.name}</strong> &nbsp; 
            ELO: <strong>${player.elo}</strong> &nbsp; 
            <span class='elo-up'>Wins: <strong>${player.wins}</strong></span> | 
            <span class='elo-down'>Losses: <strong>${player.losses}</strong></span> | 
            Draws: <strong>${player.draws}</strong>
            ${streakHtml}
        </div>
        <svg class="profile-elo-graph" width="${svgWidth}" height="${svgHeight}">
            <path d="${svgPath}" stroke="#4CAF50" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </div>`;

    // Last battles
    const personalMatches = matchHistory.filter(m => m.player1Id === player.id || m.player2Id === player.id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
    if (personalMatches.length > 0) {
        html += '<h4>Last Battles</h4><pre style="max-height:220px;overflow:auto;padding-left:0.5em;font-size:1em;">';
        personalMatches.forEach(match => {
            const isP1 = match.player1Id === player.id;
            const opponent = isP1 ? match.player2Name : match.player1Name;
            const result = match.outcome === 'draw' ? 'Draw' :
                (isP1 && match.outcome === 'p1') || (!isP1 && match.outcome === 'p2') ? 'Win' : 'Loss';
            const eloChange = isP1 ? match.player1EloChange : match.player2EloChange;
            const eloStr = (eloChange && eloChange > 0 ? '+' : '') + (eloChange || 0);
            // Odds calculation
            const p1EloBefore = match.player1EloBefore;
            const p2EloBefore = match.player2EloBefore;
            const expectedScore = 1 / (1 + Math.pow(10, ((p2EloBefore - p1EloBefore) / 400)));
            const odds = isP1 ? expectedScore : 1 - expectedScore;
            const oddsPercent = Math.round(odds * 100);
            // Odds comment
            let oddsComment = `odds: ${oddsPercent}%`;
            if (result === 'Win' && odds < 0.5) oddsComment += ' — Beat the odds!';
            // Date formatting (DD/MM HH:MM:SS)
            const d = new Date(match.timestamp);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            const dateStr = `${day}/${month} ${hours}:${minutes}:${seconds}`;
            // Color classes
            let resultClass = '';
            let eloClass = '';
            if (result === 'Win') resultClass = 'elo-up';
            else if (result === 'Loss') resultClass = 'elo-down';
            if (eloChange && eloChange > 0) eloClass = 'elo-up';
            else if (eloChange && eloChange < 0) eloClass = 'elo-down';
            html += `vs. ${opponent.padEnd(12)}\t— <span class="${resultClass}">${result.padEnd(4)}</span>\t(<span class="elo-change ${eloClass}">${eloStr}</span>)\t${dateStr}\t${oddsComment}\n`;
        });
        html += '</pre>';
    } else {
        html += '<p style="color:#aaa;">No battles yet.</p>';
    }
    content.innerHTML = html;
}
