/**
 * Game of STICK - ELO Tracker
 * Unified Error Handling Utility
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { showNotification } from '../ui/notificationSystem';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'fatal';

/**
 * Options for error handling
 */
export interface ErrorHandlerOptions {
    /** Context where the error occurred (e.g., 'SaveGame', 'LoadRegistry') */
    context: string;
    /** User-friendly message to display (if not provided, no notification shown) */
    userMessage?: string;
    /** Severity level for logging */
    severity?: ErrorSeverity;
    /** Whether to throw the error after handling (default: false) */
    rethrow?: boolean;
    /** Additional data to include in logs */
    metadata?: Record<string, unknown>;
}

/**
 * Centralized error handler for consistent error management across the app.
 * 
 * Usage:
 * ```typescript
 * try {
 *     await riskyOperation();
 * } catch (error) {
 *     handleError(error, {
 *         context: 'SaveGame',
 *         userMessage: 'Failed to save game',
 *         severity: 'error'
 *     });
 * }
 * ```
 * 
 * @param error - The caught error
 * @param options - Error handling options
 */
export function handleError(error: unknown, options: ErrorHandlerOptions): void {
    const { context, userMessage, severity = 'error', rethrow = false, metadata } = options;

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log to console with context
    const logPrefix = `[${context}]`;
    const logData = {
        message: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        ...metadata
    };

    switch (severity) {
        case 'warning':
            console.warn(logPrefix, errorMessage, logData);
            break;
        case 'fatal':
            console.error(logPrefix, '🔴 FATAL:', errorMessage, logData);
            break;
        case 'error':
        default:
            console.error(logPrefix, errorMessage, logData);
            break;
    }

    // Show user notification if message provided
    if (userMessage) {
        // Map severity to notification type (notificationSystem only supports 'success' and 'error')
        const notificationType = severity === 'warning' ? 'success' : 'error';
        showNotification(userMessage, notificationType);
    }

    // Rethrow if requested (useful for propagating critical errors)
    if (rethrow) {
        throw error;
    }
}

/**
 * Wrapper for async functions with automatic error handling.
 * 
 * Usage:
 * ```typescript
 * const safeLoadGame = withErrorHandling(loadGame, {
 *     context: 'LoadGame',
 *     userMessage: 'Failed to load game'
 * });
 * await safeLoadGame(gameId);
 * ```
 * 
 * @param fn - Async function to wrap
 * @param options - Error handling options
 * @returns Wrapped function that catches and handles errors
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: ErrorHandlerOptions
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, options);
            return undefined;
        }
    };
}

/**
 * Safe wrapper for sync functions with error handling.
 * 
 * @param fn - Function to wrap
 * @param options - Error handling options
 * @returns Wrapped function that catches and handles errors
 */
export function withErrorHandlingSync<T extends (...args: any[]) => any>(
    fn: T,
    options: ErrorHandlerOptions
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    return (...args: Parameters<T>): ReturnType<T> | undefined => {
        try {
            return fn(...args);
        } catch (error) {
            handleError(error, options);
            return undefined;
        }
    };
}

/**
 * Asserts a condition and throws with context if false.
 * Useful for invariant checking.
 * 
 * @param condition - Condition to check
 * @param context - Context for error message
 * @param message - Error message
 */
export function assertWithContext(
    condition: boolean,
    context: string,
    message: string
): asserts condition {
    if (!condition) {
        const error = new Error(`[${context}] Assertion failed: ${message}`);
        console.error(error);
        throw error;
    }
}
