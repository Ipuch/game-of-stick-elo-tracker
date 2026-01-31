/**
 * Rules Page Renderer
 * Displays the challenge flowchart and game rules
 * @author Pierre Puchaud
 */

import { t } from '../utils/i18n';

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
                <p class="rules-intro">${t('rules.intro')}</p>
                
                <!-- 1. DEFINITIONS -->
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
                
                <!-- 2. QUICK SUMMARY -->
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
                
                <!-- 3. FLOWCHART -->
                <div class="rules-flowchart">
                    <h2>${t('rules.flowchartTitle')}</h2>
                    <div class="flowchart-container">
                        ${renderFlowchart()}
                    </div>
                </div>
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
