/**
 * Authentication and Configuration
 * Burada kullanıcıların şifrelerini ve ID'lerini belirliyoruz.
 * 'id' değerleri, her kullanıcının sesli bağlantıdaki değişmez tanımlayıcısıdır.
 */

const CONFIG = {
    users: {
        'sifre1': { id: 'voice-user-1', name: 'halilaqwe' },
        'sifremaho': { id: 'voice-user-2', name: 'maho' },
        'sifrefurkan': { id: 'voice-user-3', name: 'furkan' }
    }
};

let currentUser = null;

function login(password) {
    if (CONFIG.users[password]) {
        currentUser = CONFIG.users[password];
        return true;
    }
    return false;
}

function getCurrentUser() {
    return currentUser;
}

function getAllUserIds() {
    return Object.values(CONFIG.users).map(u => u.id);
}

function getUserNameById(id) {
    const user = Object.values(CONFIG.users).find(u => u.id === id);
    return user ? user.name : "Bilinmeyen";
}
