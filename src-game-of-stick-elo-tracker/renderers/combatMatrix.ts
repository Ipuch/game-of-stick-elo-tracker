/**
 * Game of STICK - ELO Tracker
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { Player, Match } from '../types/appTypes';
import { AppDOMElements } from '../utils/domElements';
import { createElement } from '../utils/domBuilder';

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
    combatMatrixTooltip = createElement('div', {
      className: 'combat-matrix-tooltip',
      style: {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '3000',
        display: 'none',
      },
    });
    document.body.appendChild(combatMatrixTooltip);
  }
}

export function renderCombatMatrix(
  players: Player[],
  matchHistory: Match[],
  _DOMElements?: AppDOMElements // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  ensureCombatMatrixTooltip();

  // Sort players alphabetically by name
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  let container = document.getElementById('combat-matrix-section');
  if (!container) {
    const toggleBtn = createElement('button', {
      id: 'toggle-combat-matrix-btn',
      className: 'button-secondary',
      style: { float: 'right', margin: '0 0 1em 1em' },
      textContent: 'Hide Combat Matrix',
    });

    const legend = createElement('div', {
      style: { marginBottom: '1em' },
      innerHTML: '<span style="color:#dc3545;font-weight:bold;">Red</span> = never faced, <span style="color:#28a745;font-weight:bold;">Green</span> = maximum duels between two players',
    });

    container = createElement('section', {
      id: 'combat-matrix-section',
      className: 'combat-matrix-section panel',
    }, [
      toggleBtn,
      createElement('h2', { textContent: 'Combat Matrix' }),
      legend,
    ]);

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
      toggleBtn = createElement('button', {
        id: 'toggle-combat-matrix-btn',
        className: 'button-secondary',
        style: { float: 'right', margin: '0 0 1em 1em' },
        textContent: 'Hide Combat Matrix',
      });
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

    // Clear content but keep header/toggle logic. 
    // We recreate the structure to ensure consistency.
    container.innerHTML = '';
    container.appendChild(toggleBtn);
    container.appendChild(createElement('h2', { textContent: 'Combat Matrix' }));
    container.appendChild(createElement('div', {
      style: { marginBottom: '1em' },
      innerHTML: '<span style="color:#dc3545;font-weight:bold;">Red</span> = never faced, <span style="color:#28a745;font-weight:bold;">Green</span> = maximum duels between two players',
    }));
  }

  if (sortedPlayers.length === 0) {
    container.appendChild(createElement('p', { textContent: 'No players.' }));
    return;
  }

  const matrix = getCombatMatrix(sortedPlayers, matchHistory);
  let max = 0;
  for (let i = 0; i < sortedPlayers.length; i++) {
    for (let j = 0; j < sortedPlayers.length; j++) {
      if (i !== j && matrix[i][j] > max) max = matrix[i][j];
    }
  }

  // Header
  const headRow = createElement('tr', {}, [
    createElement('th'),
    ...sortedPlayers.map(p => createElement('th', { textContent: p.name, className: 'vertical-header' }))
  ]);

  const tbody = createElement('tbody');
  sortedPlayers.forEach((p, i) => {
    const row = createElement('tr');
    row.appendChild(createElement('th', { textContent: p.name }));

    sortedPlayers.forEach((_q, j) => {
      let td: HTMLElement;
      if (i === j) {
        td = createElement('td', {
          style: { background: '#232323' },
          textContent: '—'
        });
      } else if (i > j) {
        td = createElement('td', {
          textContent: String(matrix[i][j]),
          style: {
            background: getColor(matrix[i][j], max),
            color: '#fff',
            fontWeight: 'bold',
          },
          onmouseenter: () => {
            if (!combatMatrixTooltip) return;
            combatMatrixTooltip.innerHTML = `<strong>${sortedPlayers[i].name}</strong> vs <strong>${sortedPlayers[j].name}</strong><br>${matrix[i][j]} match${matrix[i][j] === 1 ? '' : 'es'}`;
            combatMatrixTooltip.style.display = 'block';
          },
          onmousemove: (e: MouseEvent) => {
            if (!combatMatrixTooltip) return;
            const pad = 12;
            let left = e.clientX + pad;
            let top = e.clientY - pad;
            const rect = combatMatrixTooltip.getBoundingClientRect();
            if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
            if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
            if (top < 0) top = 0;
            combatMatrixTooltip.style.left = left + 'px';
            combatMatrixTooltip.style.top = top + 'px';
          },
          onmouseleave: () => {
            if (combatMatrixTooltip) combatMatrixTooltip.style.display = 'none';
          }
        });
      } else {
        td = createElement('td', {
          textContent: '',
          style: { background: '#181818' }
        });
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  const table = createElement('table', { className: 'combat-matrix-table' }, [
    createElement('thead', {}, [headRow]),
    tbody
  ]);
  
  container.appendChild(table);

  // Restore hidden state if needed
  if (container.hasAttribute('data-matrix-hidden')) {
    const contentNodes = Array.from(container.children).filter(child => child.id !== 'toggle-combat-matrix-btn');
    contentNodes.forEach(node => (node as HTMLElement).style.display = 'none');
  }
} 