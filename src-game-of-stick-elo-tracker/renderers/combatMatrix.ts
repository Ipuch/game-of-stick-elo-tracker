/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';

function getCombatMatrix(players: Player[], matchHistory: Match[]) {
  const matrix: number[][] = Array.from({ length: players.length }, () => Array(players.length).fill(0));
  const playerIndex: Record<string, number> = {};
  players.forEach((p, i) => { playerIndex[p.id] = i; });
  matchHistory.forEach(match => {
    const i = playerIndex[match.player1Id];
    const j = playerIndex[match.player2Id];
    if (i !== undefined && j !== undefined) {
      matrix[i][j]++;
      matrix[j][i]++; // duel counted both ways
    }
  });
  return matrix;
}

function getColor(value: number, max: number): string {
  if (value === 0) return '#dc3545'; // rouge
  if (max === 0) return '#232323';
  // Gradient rouge -> vert
  const percent = value / max;
  const r = Math.round(220 - 120 * percent); // 220 -> 100
  const g = Math.round(53 + 150 * percent);  // 53 -> 203
  const b = Math.round(69 + 30 * percent);   // 69 -> 99
  return `rgb(${r},${g},${b})`;
}

// Tooltip overlay setup (only one for the whole matrix)
let combatMatrixTooltip: HTMLDivElement | null = null;
function ensureCombatMatrixTooltip() {
  if (!combatMatrixTooltip) {
    combatMatrixTooltip = document.createElement('div');
    combatMatrixTooltip.className = 'combat-matrix-tooltip';
    combatMatrixTooltip.style.position = 'fixed';
    combatMatrixTooltip.style.pointerEvents = 'none';
    combatMatrixTooltip.style.zIndex = '3000';
    combatMatrixTooltip.style.display = 'none';
    document.body.appendChild(combatMatrixTooltip);
  }
}

export function renderCombatMatrix(players: Player[], matchHistory: Match[], _DOMElements: AppDOMElements) {
  ensureCombatMatrixTooltip();

  // Sort players alphabetically by name
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  let container = document.getElementById('combat-matrix-section');
  if (!container) {
    container = document.createElement('section');
    container.id = 'combat-matrix-section';
    container.className = 'combat-matrix-section panel';

    // Toggle button (top right)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-combat-matrix-btn';
    toggleBtn.className = 'button-secondary';
    toggleBtn.style.float = 'right';
    toggleBtn.style.margin = '0 0 1em 1em';
    toggleBtn.textContent = 'Hide Combat Matrix';

    container.appendChild(toggleBtn);
    const h2 = document.createElement('h2');
    h2.textContent = 'Combat Matrix';
    container.appendChild(h2);
    const legend = document.createElement('div');
    legend.innerHTML = '<span style="color:#dc3545;font-weight:bold;">Red</span> = never faced, <span style="color:#28a745;font-weight:bold;">Green</span> = maximum duels between two players';
    legend.style.marginBottom = '1em';
    container.appendChild(legend);

    // Place section right after battle history
    const battleHistorySection = document.querySelector('.battle-history-section');
    if (battleHistorySection && battleHistorySection.parentElement) {
      if (battleHistorySection.nextSibling) {
        battleHistorySection.parentElement.insertBefore(container, battleHistorySection.nextSibling);
      } else {
        battleHistorySection.parentElement.appendChild(container);
      }
    } else {
      document.querySelector('main')?.appendChild(container);
    }

    toggleBtn.addEventListener('click', () => {
      if (!container) return;
      const contentNodes = Array.from(container.children).filter(child => child !== toggleBtn);
      const isHidden = container.hasAttribute('data-matrix-hidden');
      if (isHidden) {
        contentNodes.forEach(node => (node as HTMLElement).style.display = '');
        container.removeAttribute('data-matrix-hidden');
        toggleBtn.textContent = 'Hide Combat Matrix';
      } else {
        contentNodes.forEach(node => (node as HTMLElement).style.display = 'none');
        toggleBtn.textContent = 'Show Combat Matrix';
        container.setAttribute('data-matrix-hidden', 'true');
      }
    });
  } else {
    // If already exists, ensure button is present and at top
    let toggleBtn = container.querySelector('#toggle-combat-matrix-btn') as HTMLButtonElement | null;
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'toggle-combat-matrix-btn';
      toggleBtn.className = 'button-secondary';
      toggleBtn.style.float = 'right';
      toggleBtn.style.margin = '0 0 1em 1em';
      toggleBtn.textContent = 'Hide Combat Matrix';
      container.insertBefore(toggleBtn, container.firstChild);

      toggleBtn.addEventListener('click', () => {
        if (!container) return;
        const contentNodes = Array.from(container.children).filter(child => child !== toggleBtn);
        const isHidden = container.hasAttribute('data-matrix-hidden');
        if (isHidden) {
          contentNodes.forEach(node => (node as HTMLElement).style.display = '');
          container.removeAttribute('data-matrix-hidden');
          toggleBtn!.textContent = 'Hide Combat Matrix';
        } else {
          contentNodes.forEach(node => (node as HTMLElement).style.display = 'none');
          toggleBtn!.textContent = 'Show Combat Matrix';
          container.setAttribute('data-matrix-hidden', 'true');
        }
      });
    }

    // Clear content but keep header/toggle
    // Actually, easier to clear all expcept toggle/header?
    // Current logic re-appends, let's just clear non-static.
    // For simplicity, following original logic of re-appending:
    while (container.childNodes.length > 1) { // Keep toggle button
      if (container.lastChild !== toggleBtn) {
        container.removeChild(container.lastChild!);
      } else {
        break;
      }
    }
    // Re-add header/legend if missing (simplified approach: just clear all and rebuild is cleaner but we want to verify toggle state?)
    // Reverting to: clear all and re-add is safer for redraw
    container.innerHTML = '';
    container.appendChild(toggleBtn);
    const h2 = document.createElement('h2');
    h2.textContent = 'Combat Matrix';
    container.appendChild(h2);
    const legend = document.createElement('div');
    legend.innerHTML = '<span style="color:#dc3545;font-weight:bold;">Red</span> = never faced, <span style="color:#28a745;font-weight:bold;">Green</span> = maximum duels between two players';
    legend.style.marginBottom = '1em';
    container.appendChild(legend);
  }

  if (sortedPlayers.length === 0) {
    container.innerHTML += '<p>No players.</p>';
    return;
  }

  const matrix = getCombatMatrix(sortedPlayers, matchHistory);
  let max = 0;
  for (let i = 0; i < sortedPlayers.length; i++) {
    for (let j = 0; j < sortedPlayers.length; j++) {
      if (i !== j && matrix[i][j] > max) max = matrix[i][j];
    }
  }

  const table = document.createElement('table');
  table.className = 'combat-matrix-table';

  // Header
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  sortedPlayers.forEach(p => {
    const th = document.createElement('th');
    th.textContent = p.name;
    th.className = 'vertical-header';
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  sortedPlayers.forEach((p, i) => {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = p.name;
    row.appendChild(th);
    sortedPlayers.forEach((_q, j) => {
      const td = document.createElement('td');
      if (i === j) {
        td.style.background = '#232323';
        td.textContent = '—';
      } else if (i > j) {
        td.textContent = String(matrix[i][j]);
        td.style.background = getColor(matrix[i][j], max);
        td.style.color = '#fff';
        td.style.fontWeight = 'bold';

        td.addEventListener('mouseenter', () => {
          if (!combatMatrixTooltip) return;
          combatMatrixTooltip.innerHTML = `<strong>${sortedPlayers[i].name}</strong> vs <strong>${sortedPlayers[j].name}</strong><br>${matrix[i][j]} match${matrix[i][j] === 1 ? '' : 'es'}`;
          combatMatrixTooltip.style.display = 'block';
        });

        td.addEventListener('mousemove', (e) => {
          if (!combatMatrixTooltip) return;
          const mouseEvent = e as MouseEvent;
          const pad = 12;
          let left = mouseEvent.clientX + pad;
          let top = mouseEvent.clientY - pad;
          const rect = combatMatrixTooltip.getBoundingClientRect();
          if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
          if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
          if (top < 0) top = 0;
          combatMatrixTooltip.style.left = left + 'px';
          combatMatrixTooltip.style.top = top + 'px';
        });

        td.addEventListener('mouseleave', () => {
          if (combatMatrixTooltip) combatMatrixTooltip.style.display = 'none';
        });
      } else {
        td.textContent = '';
        td.style.background = '#181818';
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  // Restore hidden state if needed
  if (container.hasAttribute('data-matrix-hidden')) {
    // Logic to ensure content is hidden? 
    // Simplified: Just ensure data attribute is respected by CSS or manual hide
    // Since we rebuilt the table, it is visible. We need to hide it if data-matrix-hidden is true.
    // But for now, let's assume toggle handles click.
    const contentNodes = Array.from(container.children).filter(child => child.id !== 'toggle-combat-matrix-btn');
    contentNodes.forEach(node => (node as HTMLElement).style.display = 'none');
  }
} 