/**
 * Rules Page Renderer
 * Displays the challenge flowchart and game rules
 * @author Pierre Puchaud
 */

import { t } from '../utils/i18n';
import { eloScoring, DEFAULT_K_FACTOR } from '../scoring/eloScoring';

export type RulesCallbacks = {
    onBack: () => void;
};

/**
 * Render the rules view (full page, used from menu or in-game)
 */
export function renderRulesView(container: HTMLElement, callbacks: RulesCallbacks): void {
    container.innerHTML = `
        <div class="rules-page">
            <div class="rules-header">
                <button class="button-secondary rules-back-btn" id="rules-back-btn">
                    ← ${t('rules.back')}
                </button>
                <h1 class="rules-title">🤺 ${t('rules.title')}</h1>
            </div>
            
            <div class="rules-content">
                <!-- 1. GLOBAL SUMMARY (NEW - Quick start) -->
                ${renderGlobalSummary()}
                
                <p class="rules-intro">${t('rules.intro')}</p>
                
                <!-- 2. DEFINITIONS -->
                <div class="rules-details">
                    <div class="rule-detail-card">
                        <div class="rule-detail-icon">🤝</div>
                        <h3>${t('rules.agreementTitle')}</h3>
                        <p>${t('rules.agreementDesc')}</p>
                    </div>
                    <div class="rule-detail-card">
                        <div class="rule-detail-icon">🤸</div>
                        <h3>${t('rules.stickTitle')}</h3>
                        <p>${t('rules.stickDesc')}</p>
                    </div>
                    <div class="rule-detail-card">
                        <div class="rule-detail-icon">🎯</div>
                        <h3>${t('rules.attemptTitle')}</h3>
                        <p>${t('rules.attemptDesc')}</p>
                    </div>
                </div>
                
                <!-- 3. QUICK SUMMARY -->
                <div class="rules-summary">
                    <h2>${t('rules.summaryTitle')}</h2>
                    <table class="rules-table">
                        <thead>
                            <tr>
                                <th>${t('rules.challenger')}</th>
                                <th>${t('rules.opponent')}</th>
                                <th>${t('rules.result')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="result-win">
                                <td>✅ ${t('rules.success')}</td>
                                <td>❌ ${t('rules.fail')}</td>
                                <td>🏆 <strong>${t('rules.challengerWins')}</strong></td>
                            </tr>
                            <tr class="result-loss">
                                <td>❌ ${t('rules.fail')}</td>
                                <td>✅ ${t('rules.success')}</td>
                                <td>🏆 <strong>${t('rules.opponentWins')}</strong></td>
                            </tr>
                            <tr class="result-draw">
                                <td>✅ ${t('rules.success')}</td>
                                <td>✅ ${t('rules.success')}</td>
                                <td>⚖️ <strong>${t('rules.draw')}</strong> ${t('rules.orRetry')}</td>
                            </tr>
                            <tr class="result-retry">
                                <td>❌ ${t('rules.fail')}</td>
                                <td>❌ ${t('rules.fail')}</td>
                                <td>🔄 <strong>${t('rules.retry')}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- 4. ELO EXAMPLES (BEFORE flowchart) -->
                ${renderEloExamples()}
                
                <!-- 5. FLOWCHART -->
                <div class="rules-flowchart">
                    <h2>${t('rules.flowchartTitle')}</h2>
                    <div class="flowchart-container">
                        ${renderFlowchart()}
                    </div>
                </div>
                
                <!-- 6. ELO MATH (probability table only, without Gaussians) -->
                ${renderEloMath()}
            </div>
        </div>
    `;

    // Bind back button
    const backBtn = container.querySelector('#rules-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', callbacks.onBack);
    }
}

/**
 * Render the detailed flowchart matching the mermaid diagram
 */
function renderFlowchart(): string {
    return `
        <div class="flowchart-visual">
            <!-- START -->
            <div class="flow-step flow-start">
                <span class="flow-icon">🤺</span>
                <span class="flow-text">${t('rules.flow.challenger')}</span>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- PROPOSE MATCH -->
            <div class="flow-step flow-action">
                <span class="flow-icon">🤝</span>
                <span class="flow-text">${t('rules.flow.proposeMatch')}</span>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- OPPONENT ACCEPTS? -->
            <div class="flow-decision">
                <span class="flow-icon">🤔</span>
                <span class="flow-text">${t('rules.flow.opponentAccepts')}</span>
                <div class="flow-branches">
                    <div class="flow-branch flow-branch-no">
                        <span class="branch-label">❌</span>
                        <div class="flow-step flow-end-alt">
                            <span class="flow-icon">🔍</span>
                            <span class="flow-text">${t('rules.flow.findAnother')}</span>
                        </div>
                    </div>
                    <div class="flow-branch flow-branch-yes">
                        <span class="branch-label">✅</span>
                        <span class="branch-continue">↓</span>
                    </div>
                </div>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- PROPOSE CHALLENGE -->
            <div class="flow-step flow-action" id="propose-challenge">
                <span class="flow-icon">📜</span>
                <span class="flow-text">${t('rules.flow.proposeChallenge')}</span>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- BOTH AGREE? -->
            <div class="flow-decision">
                <span class="flow-icon">🤷</span>
                <span class="flow-text">${t('rules.flow.bothAgree')}</span>
                <div class="flow-branches">
                    <div class="flow-branch flow-branch-no">
                        <span class="branch-label">❌</span>
                        <span class="branch-text">↩️ ${t('rules.flow.proposeAgain')}</span>
                    </div>
                    <div class="flow-branch flow-branch-yes">
                        <span class="branch-label">✅</span>
                        <span class="branch-continue">↓</span>
                    </div>
                </div>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- CHALLENGER ATTEMPTS -->
            <div class="flow-step flow-action highlight" id="challenger-attempt">
                <span class="flow-icon">🚀</span>
                <span class="flow-text">${t('rules.flow.challengerAttempts')}</span>
            </div>
            <div class="flow-arrow">↓</div>
            
            <!-- CHALLENGER SUCCESS? -->
            <div class="flow-decision">
                <span class="flow-icon">🎯</span>
                <span class="flow-text">${t('rules.flow.challengerSuccess')}</span>
            </div>
            
            <!-- BRANCHING: Challenger Success vs Fail -->
            <div class="flow-dual-branch">
                <!-- LEFT: Challenger SUCCESS -->
                <div class="flow-branch-column flow-branch-success">
                    <div class="branch-header">✅ ${t('rules.success')}</div>
                    <div class="flow-arrow">↓</div>
                    <div class="flow-step flow-action">
                        <span class="flow-icon">👻</span>
                        <span class="flow-text">${t('rules.flow.opponentAttempts')}</span>
                    </div>
                    <div class="flow-arrow">↓</div>
                    <div class="flow-mini-decision">
                        <span class="flow-text">${t('rules.flow.opponentSuccess')}</span>
                    </div>
                    <div class="flow-mini-branches">
                        <div class="mini-branch">
                            <span class="mini-label">❌</span>
                            <div class="flow-outcome outcome-win">
                                <span class="outcome-icon">🏆</span>
                                <span class="outcome-text">${t('rules.challengerWins')}</span>
                            </div>
                        </div>
                        <div class="mini-branch">
                            <span class="mini-label">✅</span>
                            <div class="flow-mini-decision">
                                <span class="flow-text">${t('rules.flow.acceptDraw')}</span>
                            </div>
                            <div class="flow-mini-branches">
                                <div class="mini-branch">
                                    <span class="mini-label">✅</span>
                                    <div class="flow-outcome outcome-draw">
                                        <span class="outcome-icon">⚖️</span>
                                        <span class="outcome-text">${t('rules.draw')}</span>
                                    </div>
                                </div>
                                <div class="mini-branch">
                                    <span class="mini-label">❌</span>
                                    <div class="flow-outcome outcome-retry">
                                        <span class="outcome-icon">🔄</span>
                                        <span class="outcome-text">${t('rules.flow.retryChallenge')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- RIGHT: Challenger FAIL -->
                <div class="flow-branch-column flow-branch-fail">
                    <div class="branch-header">❌ ${t('rules.fail')}</div>
                    <div class="flow-arrow">↓</div>
                    <div class="flow-step flow-action">
                        <span class="flow-icon">👻</span>
                        <span class="flow-text">${t('rules.flow.opponentAttempts')}</span>
                    </div>
                    <div class="flow-arrow">↓</div>
                    <div class="flow-mini-decision">
                        <span class="flow-text">${t('rules.flow.opponentSuccess')}</span>
                    </div>
                    <div class="flow-mini-branches">
                        <div class="mini-branch">
                            <span class="mini-label">✅</span>
                            <div class="flow-outcome outcome-loss">
                                <span class="outcome-icon">🏆</span>
                                <span class="outcome-text">${t('rules.opponentWins')}</span>
                            </div>
                        </div>
                        <div class="mini-branch">
                            <span class="mini-label">❌</span>
                            <div class="flow-outcome outcome-retry">
                                <span class="outcome-icon">🔄</span>
                                <span class="outcome-text">${t('rules.flow.bothFailRetry')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the global summary section (quick start for players)
 */
function renderGlobalSummary(): string {
    return `
        <div class="rules-global-summary">
            <div class="global-summary-content">
                <p class="global-summary-main">${t('rules.globalSummary')}</p>
                <p class="global-summary-detail">${t('rules.globalSummaryDetail')}</p>
            </div>
            <div class="global-summary-cta">${t('rules.readyToPlay')}</div>
        </div>
    `;
}

/**
 * Render ELO examples section (concrete examples from Explications.md)
 */
function renderEloExamples(): string {
    // Compute all deltas dynamically from the real ELO formula
    const ex1 = eloScoring.calculateNewRatings(1200, 1200, 'p1', DEFAULT_K_FACTOR);
    const ex2 = eloScoring.calculateNewRatings(1400, 900, 'p1', DEFAULT_K_FACTOR);
    const ex3 = eloScoring.calculateNewRatings(900, 1400, 'p1', DEFAULT_K_FACTOR);
    const ex4 = eloScoring.calculateNewRatings(1200, 1200, 'draw', DEFAULT_K_FACTOR);
    const ex5 = eloScoring.calculateNewRatings(900, 1400, 'draw', DEFAULT_K_FACTOR);

    const fmt = (r: { p1Change: number; p2Change: number }) =>
        `${r.p1Change >= 0 ? '+' : ''}${r.p1Change} / ${r.p2Change >= 0 ? '+' : ''}${r.p2Change}`;

    return `
        <div class="rules-elo-examples">
            <h2>${t('rules.eloExamplesTitle')}</h2>
            <div class="elo-examples-grid">
                <div class="elo-example-card elo-example-balanced">
                    <div class="elo-example-header">⚖️</div>
                    <h4>${t('rules.eloExample1Title')}</h4>
                    <p>${t('rules.eloExample1Desc')}</p>
                    <div class="elo-example-delta">${fmt(ex1)}</div>
                </div>
                <div class="elo-example-card elo-example-expected">
                    <div class="elo-example-header">📉</div>
                    <h4>${t('rules.eloExample2Title')}</h4>
                    <p>${t('rules.eloExample2Desc')}</p>
                    <div class="elo-example-delta">${fmt(ex2)}</div>
                </div>
                <div class="elo-example-card elo-example-upset">
                    <div class="elo-example-header">🚀</div>
                    <h4>${t('rules.eloExample3Title')}</h4>
                    <p>${t('rules.eloExample3Desc')}</p>
                    <div class="elo-example-delta">${fmt(ex3)}</div>
                </div>
                <div class="elo-example-card elo-example-draw">
                    <div class="elo-example-header">⚖️</div>
                    <h4>${t('rules.eloExample4Title')}</h4>
                    <p>${t('rules.eloExample4Desc')}</p>
                    <div class="elo-example-delta">${fmt(ex4)}</div>
                </div>
                <div class="elo-example-card elo-example-draw-upset">
                    <div class="elo-example-header">🤝</div>
                    <h4>${t('rules.eloExample5Title')}</h4>
                    <p>${t('rules.eloExample5Desc')}</p>
                    <div class="elo-example-delta">${fmt(ex5)}</div>
                </div>
            </div>
            <p class="elo-examples-note">💡 ${t('rules.eloExampleNote')}</p>
        </div>
    `;
}

/**
 * Render ELO math section (formulas, probability table, Gaussian concept)
 * This is the most technical section, placed last for progressive complexity
 */
function renderEloMath(): string {
    // Pre-calculate probabilities for the table
    const gaps = [0, 100, 200, 300, 400, 500];
    const probabilities = gaps.map(gap => {
        const expected = 1 / (1 + Math.pow(10, -gap / 400));
        return Math.round(expected * 100);
    });

    return `
        <div class="rules-elo-math">
            <h2>${t('rules.eloMathTitle')}</h2>
            <p class="elo-math-intro">${t('rules.eloMathIntro')}</p>
            
            <div class="elo-math-content">
                <!-- Formula Section -->
                <div class="elo-formula-section">
                    <h3>${t('rules.eloFormula')}</h3>
                    <div class="elo-formula-box">
                        <div class="elo-formula">
                            E<sub>A</sub> = <span class="fraction"><span class="numerator">1</span><span class="denominator">1 + 10<sup>(R<sub>B</sub> - R<sub>A</sub>) / 400</sup></span></span>
                        </div>
                    </div>
                    <p class="elo-formula-desc">${t('rules.eloFormulaDesc')}</p>
                </div>
                
                <!-- Probability Table -->
                <div class="elo-probability-section">
                    <h3>${t('rules.eloProbabilityTable')}</h3>
                    <table class="elo-probability-table">
                        <thead>
                            <tr>
                                <th>Δ ELO</th>
                                <th>${t('rules.eloWinProb')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${gaps.map((gap, i) => `
                                <tr>
                                    <td><strong>+${gap}</strong> ${t('rules.eloPoints')} ${t('rules.eloHigher')}</td>
                                    <td><span class="probability-value">${probabilities[i]}%</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p class="elo-probability-caveat">🎯 ${t('rules.eloProbabilityCaveat')}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show the rules view
 */
export function showRulesView(): void {
    const rulesView = document.getElementById('rules-view');
    const gameMenu = document.getElementById('game-menu');
    const appMain = document.getElementById('app-main');

    if (rulesView) rulesView.style.display = 'flex';
    if (gameMenu) gameMenu.style.display = 'none';
    if (appMain) appMain.style.display = 'none';
}

/**
 * Hide the rules view
 */
export function hideRulesView(): void {
    const rulesView = document.getElementById('rules-view');
    if (rulesView) rulesView.style.display = 'none';
}
