import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAddPlayer } from '../../handlers/playerHandlers';
import { store } from '../../state/store';
import { AppDOMElements } from '../../utils/domElements';
import { AppContext } from '../../types/contextTypes';
import * as notificationSystem from '../../ui/notificationSystem';
import * as registryUtils from '../../utils/registryUtils';
import * as registryPersistence from '../../utils/registryPersistence';
import { DEFAULT_ELO_CONFIG } from '../../scoring/eloScoring';

// Mock dependencies
vi.mock('../../state/store', () => ({
    store: {
        players: [],
        registry: [],
        registryLoaded: false,
        libraryHandle: null,
    }
}));

vi.mock('../../ui/notificationSystem', () => ({
    showNotification: vi.fn(),
}));

vi.mock('../../utils/registryUtils', () => ({
    findPlayerByName: vi.fn(),
    createGlobalPlayer: vi.fn(),
    addAliasToPlayer: vi.fn(),
}));

vi.mock('../../utils/registryPersistence', () => ({
    saveRegistry: vi.fn(),
}));

describe('playerHandlers', () => {
    let mockDOMElements: AppDOMElements;
    let mockContext: AppContext;
    let mockEvent: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset store
        store.players = [];
        store.registry = [];
        store.registryLoaded = false;
        store.libraryHandle = null;

        // Setup mock DOM elements
        mockDOMElements = {
            newPlayerNameInput: { value: '' } as HTMLInputElement,
            newPlayerBirthdateInput: { value: '' } as HTMLInputElement,
            addPlayerError: { textContent: '' } as HTMLParagraphElement,
        } as AppDOMElements;

        // Setup mock context
        mockContext = {
            render: vi.fn(),
            persist: vi.fn(),
            updateKFactorInputState: vi.fn(),
            DOMElements: mockDOMElements,
        };

        // Setup mock event
        mockEvent = {
            preventDefault: vi.fn(),
        };
    });

    describe('handleAddPlayer', () => {
        it('should show error if name is empty', async () => {
            mockDOMElements.newPlayerNameInput!.value = '';
            
            await handleAddPlayer(mockEvent, mockContext);

            // Note: severity 'warning' in handleError is mapped to 'success' in showNotification
            expect(notificationSystem.showNotification).toHaveBeenCalledWith('Player name cannot be empty', 'success');
            expect(store.players.length).toBe(0);
        });

        it('should show error if player already exists in session', async () => {
            store.players = [{ name: 'Existing Player' } as any];
            mockDOMElements.newPlayerNameInput!.value = 'Existing Player';

            await handleAddPlayer(mockEvent, mockContext);

            // Note: severity 'warning' in handleError is mapped to 'success' in showNotification
            expect(notificationSystem.showNotification).toHaveBeenCalledWith('Player "Existing Player" already exists in this session!', 'success');
            expect(store.players.length).toBe(1);
        });

        it('should add a new global player if not in registry', async () => {
            const newName = 'New Player';
            const newId = 'gp-123';
            mockDOMElements.newPlayerNameInput!.value = newName;

            // Mock registry utils behavior
            vi.mocked(registryUtils.findPlayerByName).mockReturnValue(null);
            vi.mocked(registryUtils.createGlobalPlayer).mockReturnValue({
                id: newId,
                name: newName,
                aliases: [newName],
                status: 'ACTIVE',
                createdAt: Date.now(),
            } as any);

            await handleAddPlayer(mockEvent, mockContext);

            // Verify registry update
            expect(registryUtils.createGlobalPlayer).toHaveBeenCalledWith(newName, undefined);
            expect(store.registry.length).toBe(1);
            expect(store.registry[0].id).toBe(newId);

            // Verify session player creation
            expect(store.players.length).toBe(1);
            expect(store.players[0].name).toBe(newName);
            expect(store.players[0].id).toBe(newId);
            expect(store.players[0].elo).toBe(DEFAULT_ELO_CONFIG.initialRating);

            // Verify persistence and UI
            expect(mockContext.persist).toHaveBeenCalled();
            expect(mockContext.render).toHaveBeenCalled();
            expect(notificationSystem.showNotification).toHaveBeenCalledWith(expect.stringContaining('new in registry'), 'success');
            expect(mockDOMElements.newPlayerNameInput!.value).toBe('');
        });

        it('should use existing global player if found in registry', async () => {
            const existingName = 'Existing Global';
            const existingId = 'gp-456';
            const inputName = 'existing global'; // case insensitive check
            mockDOMElements.newPlayerNameInput!.value = inputName;

            const existingGlobalPlayer = {
                id: existingId,
                name: existingName,
                aliases: [existingName],
                status: 'ACTIVE',
                createdAt: Date.now(),
            } as any;
            // Pre-populate registry? Or just mock finding it.
            // The handler pushes to store.registry only if new.
            // But if found, it modifies it in place (addAlias).
            // So let's put it in the store first if we want realistic behavior, 
            // OR rely on the fact that `findPlayerByName` returns a reference.
            
            vi.mocked(registryUtils.findPlayerByName).mockReturnValue(existingGlobalPlayer);

            await handleAddPlayer(mockEvent, mockContext);

            // Verify registry utils usage
            expect(registryUtils.createGlobalPlayer).not.toHaveBeenCalled();
            expect(registryUtils.addAliasToPlayer).toHaveBeenCalledWith(existingGlobalPlayer, inputName);

            // Verify session player creation using existing ID
            expect(store.players.length).toBe(1);
            expect(store.players[0].name).toBe(inputName); // Use the input name for the session player
            expect(store.players[0].id).toBe(existingId);

            expect(notificationSystem.showNotification).toHaveBeenCalledWith(expect.stringContaining('from registry'), 'success');
        });

        it('should save registry if library handle is present', async () => {
            const newName = 'Saved Player';
            mockDOMElements.newPlayerNameInput!.value = newName;
            store.libraryHandle = {} as any; // Mock handle presence
            store.registryLoaded = true;

            vi.mocked(registryUtils.findPlayerByName).mockReturnValue(null);
            vi.mocked(registryUtils.createGlobalPlayer).mockReturnValue({
                id: 'gp-789',
                name: newName,
                aliases: [newName],
                status: 'ACTIVE',
                createdAt: Date.now(),
            } as any);

            await handleAddPlayer(mockEvent, mockContext);

            expect(registryPersistence.saveRegistry).toHaveBeenCalledWith(store.libraryHandle, store.registry);
        });

        it('should handle birthdate input', async () => {
            const name = 'Birthday Player';
            const birthDate = '2000-01-01';
            mockDOMElements.newPlayerNameInput!.value = name;
            mockDOMElements.newPlayerBirthdateInput!.value = birthDate;

            vi.mocked(registryUtils.findPlayerByName).mockReturnValue(null);
            vi.mocked(registryUtils.createGlobalPlayer).mockReturnValue({
                id: 'gp-bday',
                name: name,
                aliases: [name],
                birthDate: birthDate,
                status: 'ACTIVE',
                createdAt: Date.now(),
            } as any);

            await handleAddPlayer(mockEvent, mockContext);

            expect(registryUtils.createGlobalPlayer).toHaveBeenCalledWith(name, birthDate);
        });
    });
});
