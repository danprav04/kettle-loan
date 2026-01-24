// Server-side notification message localization utility
import en from '../../messages/en.json';
import he from '../../messages/he.json';
import ru from '../../messages/ru.json';

type Locale = 'en' | 'he' | 'ru';

interface PushNotificationMessages {
    newEntryTitle: string;
    entryDeletedTitle: string;
    addedExpense: string;
    addedLoan: string;
    removedEntry: string;
}

const messages: Record<Locale, PushNotificationMessages> = {
    en: en.PushNotifications,
    he: he.PushNotifications,
    ru: ru.PushNotifications,
};

export function getNotificationMessages(locale: string): PushNotificationMessages {
    const validLocale = (locale in messages ? locale : 'en') as Locale;
    return messages[validLocale];
}

// Simple template interpolation for notification messages
export function formatMessage(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
