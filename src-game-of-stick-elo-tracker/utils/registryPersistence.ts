/**
 * Game of S.T.I.C.K. - ELO Tracker
 * Registry Persistence (CSV-based)
 * @author Pierre Puchaud
 * @copyright 2024 Pierre Puchaud
 */

import { GlobalPlayer } from '../types/registryTypes';
import { escapeCsvValue, parseCSV } from './csvUtils';

const REGISTRY_FILE = 'registry.csv';

/**
 * Convert a GlobalPlayer array to CSV format.
 * Aliases are stored as pipe-separated values.
 */
export function registryToCSV(players: GlobalPlayer[]): string {
    const headers = ['id', 'name', 'aliases', 'birthDate', 'status', 'createdAt'].join(',');

    const rows = players.map(p => {
        const aliasesStr = p.aliases.join('|');
        return [
            escapeCsvValue(p.id),
            escapeCsvValue(p.name),
            escapeCsvValue(aliasesStr),
            escapeCsvValue(p.birthDate || ''),
            escapeCsvValue(p.status),
            p.createdAt
        ].join(',');
    });

    return [headers, ...rows].join('\n');
}

/**
 * Parse CSV content into a GlobalPlayer array.
 * Handles pipe-separated aliases.
 */
export function csvToRegistry(csv: string): GlobalPlayer[] {
    const rows = parseCSV(csv);

    return rows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        aliases: row[2] ? row[2].split('|').filter(a => a.trim() !== '') : [],
        birthDate: row[3] || undefined,
        status: (row[4] === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
        createdAt: parseInt(row[5]) || Date.now()
    }));
}

/**
 * Load the player registry from the library folder.
 * Returns an empty array if the registry doesn't exist yet.
 */
export async function loadRegistry(
    libraryHandle: FileSystemDirectoryHandle
): Promise<GlobalPlayer[]> {
    try {
        const fileHandle = await libraryHandle.getFileHandle(REGISTRY_FILE);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return csvToRegistry(text);
    } catch (e) {
        // File doesn't exist yet - return empty registry
        console.log('Registry file not found, starting with empty registry.');
        return [];
    }
}

/**
 * Save the player registry to the library folder.
 */
export async function saveRegistry(
    libraryHandle: FileSystemDirectoryHandle,
    players: GlobalPlayer[]
): Promise<void> {
    try {
        const fileHandle = await libraryHandle.getFileHandle(REGISTRY_FILE, { create: true });
        const writable = await fileHandle.createWritable();
        const csv = registryToCSV(players);
        await writable.write(csv);
        await writable.close();
    } catch (e) {
        console.error('Failed to save registry:', e);
        throw e;
    }
}

/**
 * Check if a registry file exists in the library.
 */
export async function registryExists(
    libraryHandle: FileSystemDirectoryHandle
): Promise<boolean> {
    try {
        await libraryHandle.getFileHandle(REGISTRY_FILE);
        return true;
    } catch {
        return false;
    }
}
