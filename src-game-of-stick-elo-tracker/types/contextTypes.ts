/**
 * Game of STICK - ELO Tracker
 * Unified Context Types
 * Consolidates all handler context types to avoid duplication
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { AppDOMElements } from '../utils/domElements';

/**
 * Core application context shared across all handlers
 */
export interface AppContext {
    /** Re-render all UI components */
    render: () => void;
    /** Persist current state to storage */
    persist: () => void;
    /** Update K-factor input state (enabled/disabled) */
    updateKFactorInputState: () => void;
    /** DOM element references */
    DOMElements: AppDOMElements;
}

/**
 * Extended context for match handlers
 */
export interface MatchContext extends AppContext {
    /** Render without updating leaderboard/podium (for real-time updates) */
    renderWithoutLeaderboard: () => void;
}

/**
 * Extended context for session handlers
 */
export interface SessionContext {
    /** Re-render all UI components */
    render: () => void;
    /** Update save button state */
    updateSaveButton: () => void;
    /** Render the game menu */
    renderGameMenu: () => void;
}

/**
 * Context for autocomplete handlers
 */
export interface AutocompleteContext {
    /** Update winner labels when player selection changes */
    updateWinnerLabels: () => void;
}

/**
 * Context for import handlers
 */
export interface ImportContext {
    /** Re-render all UI components */
    render: () => void;
    /** Update K-factor input state */
    updateKFactorInputState: () => void;
    /** DOM element references */
    DOMElements: AppDOMElements;
}

/**
 * Callbacks for sync service
 */
export interface SyncCallbacks {
    /** Called when sync starts */
    onSyncStart: () => void;
    /** Called when sync completes */
    onSyncComplete: () => void;
    /** Update K-factor input state */
    updateKFactorInputState: () => void;
    /** Update save button state */
    updateSaveButton: () => void;
    /** Re-render all UI components */
    renderAll: () => void;
}

/**
 * Factory function to create match context from app context
 */
export function createMatchContext(
    appContext: AppContext, 
    renderWithoutLeaderboard: () => void
): MatchContext {
    return {
        ...appContext,
        renderWithoutLeaderboard
    };
}

/**
 * Factory function to create import context from app context
 */
export function createImportContext(appContext: AppContext): ImportContext {
    return {
        render: appContext.render,
        updateKFactorInputState: appContext.updateKFactorInputState,
        DOMElements: appContext.DOMElements
    };
}
