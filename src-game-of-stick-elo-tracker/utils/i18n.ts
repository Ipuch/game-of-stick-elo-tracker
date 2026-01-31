/**
 * Internationalization (i18n) module for Game of STICK
 * Supports English and French with instant language switching.
 * @author Pierre Puchaud
 */

import enTranslations from '../locales/en.json';
import frTranslations from '../locales/fr.json';

export type Locale = 'en' | 'fr';

const translations: Record<Locale, Record<string, any>> = {
    en: enTranslations,
    fr: frTranslations,
};

let currentLocale: Locale = 'fr'; // Default to French

/**
 * Initialize i18n system from stored preference
 */
export function initI18n(): void {
    const saved = localStorage.getItem('locale') as Locale | null;
    currentLocale = saved && (saved === 'en' || saved === 'fr') ? saved : 'fr';
    updateHtmlLang();
}

/**
 * Get translation by dot-notation key
 * @example t('nav.leaderboard') → 'Classement'
 */
export function t(key: string, ...args: string[]): string {
    const keys = key.split('.');
    let value: any = translations[currentLocale];

    for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
            console.warn(`Translation missing: ${key}`);
            return key;
        }
    }

    let text = typeof value === 'string' ? value : key;

    // Replace {0}, {1}, etc. with args
    args.forEach((arg, index) => {
        text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
    });

    return text;
}

/**
 * Toggle between French and English
 */
export function toggleLocale(): void {
    currentLocale = currentLocale === 'en' ? 'fr' : 'en';
    localStorage.setItem('locale', currentLocale);
    updateHtmlLang();

    // Dispatch event for UI components to refresh
    window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale: currentLocale } }));
}

/**
 * Set specific locale
 */
export function setLocale(locale: Locale): void {
    if (locale !== currentLocale) {
        currentLocale = locale;
        localStorage.setItem('locale', currentLocale);
        updateHtmlLang();
        window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale: currentLocale } }));
    }
}

/**
 * Get current locale
 */
export function getLocale(): Locale {
    return currentLocale;
}

/**
 * Get flag emoji for current locale
 */
export function getLocaleFlag(): string {
    return currentLocale === 'fr' ? '🇫🇷' : '🇬🇧';
}

/**
 * Format date according to current locale
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString(currentLocale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Format number according to current locale (e.g., 1 234 vs 1,234)
 */
export function formatNumber(num: number): string {
    return num.toLocaleString(currentLocale === 'fr' ? 'fr-FR' : 'en-GB');
}

/**
 * Update HTML lang attribute
 */
function updateHtmlLang(): void {
    document.documentElement.lang = currentLocale;
}

/**
 * Update all locale toggle buttons in the UI
 */
export function updateLocaleButtons(): void {
    const flag = getLocaleFlag();
    document.querySelectorAll('.locale-toggle').forEach(btn => {
        btn.textContent = flag;
    });
}
