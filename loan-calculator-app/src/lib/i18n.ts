import { createI18n } from 'react-router-i18n';

const locales = ['en', 'ru', 'he'];

const translations = {
    en: {
        login: 'Login',
        signup: 'Sign Up',
        username: 'Username',
        password: 'Password',
        'create-room': 'Create Room',
        'join-room': 'Join Room',
        'room-code': 'Room Code',
        'add-entry': 'Add Entry',
        amount: 'Amount',
        description: 'Description',
        'owe-you': 'Owe You',
        'you-owe': 'You Owe',
        'all-entries': 'All Entries',
        'back-to-room': 'Back to Room',
        'join-or-create-room': 'Join or Create Room'
    },
    ru: {
        login: 'Войти',
        signup: 'Зарегистрироваться',
        username: 'Имя пользователя',
        password: 'Пароль',
        'create-room': 'Создать комнату',
        'join-room': 'Присоединиться к комнате',
        'room-code': 'Код комнаты',
        'add-entry': 'Добавить запись',
        amount: 'Сумма',
        description: 'Описание',
        'owe-you': 'Вам должны',
        'you-owe': 'Вы должны',
        'all-entries': 'Все записи',
        'back-to-room': 'Вернуться в комнату',
        'join-or-create-room': 'Присоединиться или создать комнату'
    },
    he: {
        login: 'התחברות',
        signup: 'הרשמה',
        username: 'שם משתמש',
        password: 'סיסמה',
        'create-room': 'צור חדר',
        'join-room': 'הצטרף לחדר',
        'room-code': 'קוד חדר',
        'add-entry': 'הוסף רשומה',
        amount: 'סכום',
        description: 'תיאור',
        'owe-you': 'חייבים לך',
        'you-owe': 'אתה חייב',
        'all-entries': 'כל הרשומות',
        'back-to-room': 'חזור לחדר',
        'join-or-create-room': 'הצטרף או צור חדר'
    }
};

export const { I18nProvider, useI18n } = createI18n(locales, translations);