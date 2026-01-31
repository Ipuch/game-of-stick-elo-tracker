import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRecordMatch, updateWinnerLabels } from '../../handlers/matchHandlers';
import { store } from '../../state/store';
import { AppDOMElements } from '../../utils/domElements';
import { MatchContext } from '../../types/contextTypes';
import * as notificationSystem from '../../ui/notificationSystem';
import * as statsUtils from '../../utils/statsUtils';
import * as autocomplete from '../../ui/autocomplete';
import * as opponentsRenderer from '../../renderers/opponentsRenderer';
import { eloScoring } from '../../scoring/eloScoring';

// Mock UUID
vi.mock('../../utils/uuid', () => ({
    generateUUID: vi.fn(() => 'mock-uuid'),
}));

// Mock dependencies
vi.mock('../../state/store', () => ({
    store: {
        players: [],
        matchHistory: [],
        kFactor: 32,
    }
}));

vi.mock('../../ui/notificationSystem', () => ({
    showNotification: vi.fn(),
}));

vi.mock('../../utils/statsUtils', () => ({
    calculatePlayerStreaks: vi.fn(),
}));

vi.mock('../../ui/autocomplete', () => ({
    hideSuggestions: vi.fn(),
}));

vi.mock('../../renderers/opponentsRenderer', () => ({
    renderRemainingOpponents: vi.fn(),
}));

// Mock eloScoring to return predictable results
vi.spyOn(eloScoring, 'calculateNewRatings').mockReturnValue({
    newP1Rating: 1210,
    newP2Rating: 1190,
    p1Change: 10,
    p2Change: -10
});

describe('matchHandlers', () => {
    let mockDOMElements: AppDOMElements;
    let mockContext: MatchContext;
    let mockEvent: any;
    let mockForm: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset store
        store.players = [];
        store.matchHistory = [];
        store.kFactor = 32;

        // Setup mock DOM elements
        mockDOMElements = {
            player1Input: { value: '' } as HTMLInputElement,
            player2Input: { value: '' } as HTMLInputElement,
            player1IdInput: { value: '' } as HTMLInputElement,
            player2IdInput: { value: '' } as HTMLInputElement,
            winnerP1Label: { textContent: '' } as HTMLLabelElement,
            winnerP2Label: { textContent: '' } as HTMLLabelElement,
            matchError: { textContent: '' } as HTMLParagraphElement,
            player1Suggestions: {} as HTMLElement,
            player2Suggestions: {} as HTMLElement,
        } as AppDOMElements;

        // Setup mock context
        mockContext = {
            render: vi.fn(),
            renderWithoutLeaderboard: vi.fn(),
            persist: vi.fn(),
            updateKFactorInputState: vi.fn(),
            DOMElements: mockDOMElements,
        };

        // Setup mock form and event
        mockForm = {
            reset: vi.fn(),
        };
        
        // Mock FormData
        const formData = new Map();
        mockEvent = {
            preventDefault: vi.fn(),
            target: mockForm,
        };
        
        // Handle global FormData mock if needed, but since handleRecordMatch uses new FormData(event.target),
        // we might need to intercept that constructor or mock the form behavior better.
        // Since we can't easily mock `new FormData(form)` in JSDOM/Node environment without more setup,
        // we can assume the handler gets the winner from formData.
        // A common workaround is to mock the global FormData or wrap the logic. 
        // For this test, let's mock the global FormData constructor.
        
        global.FormData = class {
            constructor(form: any) {
                // simple mock implementation
            }
            get(key: string) {
                return formData.get(key);
            }
        } as any;
        
        // Helper to set winner in our mock FormData
        (mockEvent as any).setWinner = (winner: string) => {
            formData.set('winner', winner);
        };
    });

    describe('handleRecordMatch', () => {
        it('should show error if players are not selected', () => {
            mockDOMElements.player1IdInput!.value = '';
            mockDOMElements.player2IdInput!.value = 'p2';

            handleRecordMatch(mockEvent, mockContext);

            expect(mockDOMElements.matchError!.textContent).toBe('Please select both players from the list.');
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(store.matchHistory.length).toBe(0);
        });

        it('should show error if players are the same', () => {
            mockDOMElements.player1IdInput!.value = 'p1';
            mockDOMElements.player2IdInput!.value = 'p1';

            handleRecordMatch(mockEvent, mockContext);

            expect(mockDOMElements.matchError!.textContent).toBe('Players cannot be the same.');
            expect(store.matchHistory.length).toBe(0);
        });

        it('should show error if outcome is not selected', () => {
            mockDOMElements.player1IdInput!.value = 'p1';
            mockDOMElements.player2IdInput!.value = 'p2';
            (mockEvent as any).setWinner(null);

            handleRecordMatch(mockEvent, mockContext);

            expect(mockDOMElements.matchError!.textContent).toBe('Please select the outcome.');
        });

        it('should show error if players are not found in store', () => {
            mockDOMElements.player1IdInput!.value = 'p1';
            mockDOMElements.player2IdInput!.value = 'p2';
            (mockEvent as any).setWinner('p1');
            store.players = []; // Empty store

            handleRecordMatch(mockEvent, mockContext);

            expect(mockDOMElements.matchError!.textContent).toBe('One or more players not found.');
        });

        it('should successfully record a match where P1 wins', () => {
            // Setup players
            const p1 = { id: 'p1', name: 'Player 1', elo: 1200, wins: 0, losses: 0, draws: 0 } as any;
            const p2 = { id: 'p2', name: 'Player 2', elo: 1200, wins: 0, losses: 0, draws: 0 } as any;
            store.players = [p1, p2];

            // Setup inputs
            mockDOMElements.player1IdInput!.value = 'p1';
            mockDOMElements.player2IdInput!.value = 'p2';
            mockDOMElements.player1Input!.value = 'Player 1';
            mockDOMElements.player2Input!.value = 'Player 2';
            (mockEvent as any).setWinner('p1');

            handleRecordMatch(mockEvent, mockContext);

            // Verify store updates
            expect(store.matchHistory.length).toBe(1);
            expect(store.matchHistory[0].outcome).toBe('p1');
            expect(store.matchHistory[0].player1Id).toBe('p1');
            expect(store.matchHistory[0].player2Id).toBe('p2');

            // Verify ELO updates (using mocked values 1210 and 1190)
            expect(p1.elo).toBe(1210);
            expect(p2.elo).toBe(1190);
            expect(p1.wins).toBe(1);
            expect(p2.losses).toBe(1);

            // Verify stats recalculation
            expect(statsUtils.calculatePlayerStreaks).toHaveBeenCalledWith(store.players, store.matchHistory);

            // Verify UI updates
            expect(mockContext.updateKFactorInputState).toHaveBeenCalled();
            expect(mockContext.persist).toHaveBeenCalled();
            expect(notificationSystem.showNotification).toHaveBeenCalledWith('Player 1 won against Player 2', 'success');
            expect(mockForm.reset).toHaveBeenCalled();
            expect(mockContext.renderWithoutLeaderboard).toHaveBeenCalled();
        });
        
        it('should successfully record a match with a Draw', () => {
             // Setup players
            const p1 = { id: 'p1', name: 'Player 1', elo: 1200, wins: 0, losses: 0, draws: 0 } as any;
            const p2 = { id: 'p2', name: 'Player 2', elo: 1200, wins: 0, losses: 0, draws: 0 } as any;
            store.players = [p1, p2];

            // Setup inputs
            mockDOMElements.player1IdInput!.value = 'p1';
            mockDOMElements.player2IdInput!.value = 'p2';
            (mockEvent as any).setWinner('draw');

            handleRecordMatch(mockEvent, mockContext);

            expect(p1.draws).toBe(1);
            expect(p2.draws).toBe(1);
            expect(notificationSystem.showNotification).toHaveBeenCalledWith('Draw between Player 1 and Player 2', 'success');
        });
    });

    describe('updateWinnerLabels', () => {
        it('should update labels with player names', () => {
            mockDOMElements.player1Input!.value = 'Alice';
            mockDOMElements.player2Input!.value = 'Bob';

            updateWinnerLabels(mockDOMElements);

            expect(mockDOMElements.winnerP1Label!.textContent).toBe('Alice Wins');
            expect(mockDOMElements.winnerP2Label!.textContent).toBe('Bob Wins');
            expect(opponentsRenderer.renderRemainingOpponents).toHaveBeenCalled();
        });

        it('should use default names if inputs are empty', () => {
            mockDOMElements.player1Input!.value = '';
            mockDOMElements.player2Input!.value = '   ';

            updateWinnerLabels(mockDOMElements);

            expect(mockDOMElements.winnerP1Label!.textContent).toBe('Player 1 Wins');
            expect(mockDOMElements.winnerP2Label!.textContent).toBe('Player 2 Wins');
        });
    });
});
