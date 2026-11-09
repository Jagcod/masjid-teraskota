/**
 * Firebase Configuration - Masjid Teraskota
 * 
 * IMPORTANT: Replace the placeholder values below with your actual Firebase project config.
 * You can find these values in Firebase Console > Project Settings > General > Your apps > Web app.
 * 
 * These are CLIENT-SIDE credentials and are safe to include in public repositories.
 * Security is enforced through Firebase Authentication and Security Rules, NOT by hiding these keys.
 */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCvsfPk88SOvQheP--w2CTfuEnqZyGAftE",
    authDomain: "masjidtv-57edd.firebaseapp.com",
    projectId: "masjidtv-57edd",
    storageBucket: "masjidtv-57edd.firebasestorage.app",
    messagingSenderId: "597935556919",
    appId: "1:597935556919:web:c9fe398b8018d4e14cb2b2"
};

/**
 * Check if Firebase is configured with real credentials
 */
function isFirebaseConfigured() {
    const key = (FIREBASE_CONFIG.apiKey || '').toLowerCase();
    const project = (FIREBASE_CONFIG.projectId || '').toLowerCase();
    const placeholders = ['your_api_key', 'placeholder_api_key', 'your-api-key', 'placeholder', ''];
    const projectPlaceholders = ['your_project_id', 'your-project-id', 'placeholder', ''];
    
    const keyIsPlaceholder = placeholders.some(p => key === p || key.includes('placeholder') || key.includes('your_'));
    const projectIsPlaceholder = projectPlaceholders.some(p => project === p || project.includes('placeholder') || project.includes('your-') || project.includes('your_'));
    
    return !keyIsPlaceholder && !projectIsPlaceholder;
}

/**
 * Firebase SDK URLs (using CDN for static hosting compatibility)
 * Using Firebase v10 modular SDK via compat mode for broader browser support
 */
const FIREBASE_SDK_VERSION = '10.12.2';
const FIREBASE_CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

const FIREBASE_SCRIPTS = [
    `${FIREBASE_CDN_BASE}/firebase-app-compat.js`,
    `${FIREBASE_CDN_BASE}/firebase-auth-compat.js`,
    `${FIREBASE_CDN_BASE}/firebase-firestore-compat.js`,
    `${FIREBASE_CDN_BASE}/firebase-storage-compat.js`
];

/**
 * Dynamically load Firebase SDK scripts
 * @returns {Promise<void>}
 */
function loadFirebaseSDK() {
    if (window._firebaseSDKLoaded) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        let loadedCount = 0;
        const totalScripts = FIREBASE_SCRIPTS.length;

        // Load scripts sequentially to ensure correct order
        function loadNext(index) {
            if (index >= totalScripts) {
                window._firebaseSDKLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = FIREBASE_SCRIPTS[index];
            script.onload = () => {
                loadedCount++;
                loadNext(index + 1);
            };
            script.onerror = () => {
                console.warn(`[Firebase] Failed to load SDK script: ${FIREBASE_SCRIPTS[index]}`);
                // Continue loading remaining scripts
                loadNext(index + 1);
            };
            document.head.appendChild(script);
        }

        loadNext(0);
    });
}

/**
 * Initialize Firebase app
 * @returns {Promise<object|null>} Firebase app instance or null if not configured
 */
async function initializeFirebase() {
    if (!isFirebaseConfigured()) {
        console.info('[Firebase] Not configured. Running in demo/offline mode.');
        return null;
    }

    try {
        await loadFirebaseSDK();

        if (typeof firebase === 'undefined') {
            console.warn('[Firebase] SDK not available after loading.');
            return null;
        }

        // Check if already initialized
        if (firebase.apps.length > 0) {
            return firebase.app();
        }

        const app = firebase.initializeApp(FIREBASE_CONFIG);
        console.info('[Firebase] Initialized successfully.');
        return app;
    } catch (error) {
        console.error('[Firebase] Initialization error:', error);
        return null;
    }
}

// Make available globally
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.isFirebaseConfigured = isFirebaseConfigured;
window.initializeFirebase = initializeFirebase;
