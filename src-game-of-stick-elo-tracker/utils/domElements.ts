export interface AppDOMElements {
    leaderboardBody: HTMLTableSectionElement | null;
    leaderboardSection: HTMLElement | null;
    updateLeaderboardBtnContainer: HTMLElement | null;
    updateLeaderboardBtn: HTMLButtonElement | null;
    addPlayerForm: HTMLFormElement | null;
    newPlayerNameInput: HTMLInputElement | null;
    addPlayerError: HTMLParagraphElement | null;
    recordMatchForm: HTMLFormElement | null;
    player1Input: HTMLInputElement | null;
    player1IdInput: HTMLInputElement | null;
    player1Suggestions: HTMLElement | null;
    player2Input: HTMLInputElement | null;
    player2IdInput: HTMLInputElement | null;
    player2Suggestions: HTMLElement | null;
    winnerP1Label: HTMLLabelElement | null;
    winnerP2Label: HTMLLabelElement | null;
    matchError: HTMLParagraphElement | null;
    podiumContainer: HTMLElement | null;
    kFactorInput: HTMLInputElement | null;
    settingsForm: HTMLFormElement | null;
    realtimeUpdateToggle: HTMLInputElement | null;
    exportPlayersBtn: HTMLButtonElement | null;
    exportMatchesBtn: HTMLButtonElement | null;
    toggleBattleHistoryBtn: HTMLButtonElement | null;
    battleHistoryContainer: HTMLElement | null;
    battleHistoryList: HTMLElement | null;
    importMatchesFile: HTMLInputElement | null;
    importPlayersFile: HTMLInputElement | null;
    clearHistoryBtn: HTMLButtonElement | null;
    clearPlayersBtn: HTMLButtonElement | null;
    playerCardModal: HTMLElement | null;
    closePlayerCardBtn: HTMLButtonElement | null;
}

export function queryDOMElements(): AppDOMElements {
    return {
        leaderboardBody: document.getElementById('leaderboard-body') as HTMLTableSectionElement,
        leaderboardSection: document.querySelector('.leaderboard-section'),
        updateLeaderboardBtnContainer: document.getElementById('update-leaderboard-container'),
        updateLeaderboardBtn: document.getElementById('update-leaderboard-btn') as HTMLButtonElement,
        addPlayerForm: document.getElementById('add-player-form') as HTMLFormElement,
        newPlayerNameInput: document.getElementById('new-player-name') as HTMLInputElement,
        addPlayerError: document.getElementById('add-player-error') as HTMLParagraphElement,
        recordMatchForm: document.getElementById('record-match-form') as HTMLFormElement,
        player1Input: document.getElementById('player1-input') as HTMLInputElement,
        player1IdInput: document.getElementById('player1-id') as HTMLInputElement,
        player1Suggestions: document.getElementById('player1-suggestions') as HTMLElement,
        player2Input: document.getElementById('player2-input') as HTMLInputElement,
        player2IdInput: document.getElementById('player2-id') as HTMLInputElement,
        player2Suggestions: document.getElementById('player2-suggestions') as HTMLElement,
        winnerP1Label: document.getElementById('winner-p1-label') as HTMLLabelElement,
        winnerP2Label: document.getElementById('winner-p2-label') as HTMLLabelElement,
        matchError: document.getElementById('match-error') as HTMLParagraphElement,
        podiumContainer: document.getElementById('podium-container'),
        kFactorInput: document.getElementById('k-factor-input') as HTMLInputElement,
        settingsForm: document.getElementById('settings-form') as HTMLFormElement,
        realtimeUpdateToggle: document.getElementById('realtime-update-toggle') as HTMLInputElement,
        exportPlayersBtn: document.getElementById('export-players-btn') as HTMLButtonElement,
        exportMatchesBtn: document.getElementById('export-matches-btn') as HTMLButtonElement,
        toggleBattleHistoryBtn: document.getElementById('toggle-battle-history-btn') as HTMLButtonElement,
        battleHistoryContainer: document.getElementById('battle-history-container') as HTMLElement,
        battleHistoryList: document.getElementById('battle-history-list') as HTMLElement,
        importMatchesFile: document.getElementById('import-matches-file') as HTMLInputElement,
        importPlayersFile: document.getElementById('import-players-file') as HTMLInputElement,
        clearHistoryBtn: document.getElementById('clear-history-btn') as HTMLButtonElement,
        clearPlayersBtn: document.getElementById('clear-players-btn') as HTMLButtonElement,
        playerCardModal: document.getElementById('player-card-modal') as HTMLElement,
        closePlayerCardBtn: document.getElementById('close-player-card-btn') as HTMLButtonElement,
    };
} 