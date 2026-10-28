/**
 * Firestore Service - Masjid Teraskota
 * 
 * Provides CRUD operations and realtime listeners for Firestore.
 * Works in two modes:
 * 1. Online mode: Connected to Firebase Firestore
 * 2. Demo mode: Returns demo data when Firebase is not configured
 * 
 * Collections:
 * - settings: Mosque identity, prayer config, display settings
 * - prayerSchedules: Manual prayer time overrides
 * - kajian: Islamic study schedules
 * - activities: Mosque activities/events
 * - news: News items
 * - announcements: Public announcements
 * - fridaySchedules: Friday prayer info (khatib, imam, muazin)
 * - financeReports: Financial/ZISWAF reports
 * - qris: QRIS payment codes
 * - displaySlides: Custom display slides config
 */

const FirestoreService = (() => {
    'use strict';

    let _db = null;
    let _isOnline = false;
    let _listeners = [];

    /**
     * Initialize Firestore
     */
    async function init() {
        if (!isFirebaseConfigured()) {
            console.info('[Firestore] Not configured. Using demo data.');
            _isOnline = false;
            return false;
        }

        try {
            const app = await initializeFirebase();
            if (app && firebase.firestore) {
                _db = firebase.firestore();
                
                // Enable offline persistence
                try {
                    await _db.enablePersistence({ synchronizeTabs: true });
                } catch (err) {
                    if (err.code === 'failed-precondition') {
                        console.warn('[Firestore] Persistence failed: multiple tabs open.');
                    } else if (err.code === 'unimplemented') {
                        console.warn('[Firestore] Persistence not supported by browser.');
                    }
                }

                _isOnline = true;
                console.info('[Firestore] Ready.');
                return true;
            }
        } catch (error) {
            console.error('[Firestore] Init error:', error);
        }

        _isOnline = false;
        return false;
    }

    function isOnline() {
        return _isOnline;
    }

    // ── CRUD Operations ──

    /**
     * Get a single document
     */
    async function getDocument(collection, docId) {
        if (!_isOnline) return getDemoData(collection, docId);

        try {
            const doc = await _db.collection(collection).doc(docId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error(`[Firestore] Get ${collection}/${docId} error:`, error);
            return getDemoData(collection, docId);
        }
    }

    /**
     * Get all documents from a collection
     */
    async function getCollection(collection, options = {}) {
        if (!_isOnline) return getDemoCollection(collection, options);

        try {
            let query = _db.collection(collection);

            // Apply filters
            if (options.where) {
                for (const [field, op, value] of options.where) {
                    query = query.where(field, op, value);
                }
            }

            // Apply ordering
            if (options.orderBy) {
                query = query.orderBy(options.orderBy, options.orderDir || 'asc');
            }

            // Apply limit
            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`[Firestore] Get collection ${collection} error:`, error);
            return getDemoCollection(collection, options);
        }
    }

    /**
     * Set/create a document (overwrites)
     */
    async function setDocument(collection, docId, data) {
        if (!_isOnline) {
            const store = getDemoStore();
            if (!store[collection]) store[collection] = {};
            store[collection][docId] = {
                ...store[collection][docId],
                ...data,
                updatedAt: new Date().toISOString()
            };
            saveDemoStore(store);
            notifyLocalChange(collection, docId);
            return { id: docId, ...data };
        }

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const docData = {
            ...data,
            updatedAt: timestamp
        };

        if (!data.createdAt) {
            docData.createdAt = timestamp;
        }

        await _db.collection(collection).doc(docId).set(docData, { merge: true });
        return { id: docId, ...data };
    }

    /**
     * Add a new document (auto-ID)
     */
    async function addDocument(collection, data) {
        if (!_isOnline) {
            const store = getDemoStore();
            if (!store[collection]) store[collection] = {};
            const docId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const timestamp = new Date().toISOString();
            store[collection][docId] = {
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp
            };
            saveDemoStore(store);
            notifyLocalChange(collection, docId);
            return { id: docId, ...data };
        }

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const docData = {
            ...data,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const ref = await _db.collection(collection).add(docData);
        return { id: ref.id, ...data };
    }

    /**
     * Update a document (partial update)
     */
    async function updateDocument(collection, docId, data) {
        if (!_isOnline) {
            const store = getDemoStore();
            if (store[collection] && store[collection][docId]) {
                store[collection][docId] = {
                    ...store[collection][docId],
                    ...data,
                    updatedAt: new Date().toISOString()
                };
                saveDemoStore(store);
                notifyLocalChange(collection, docId);
            }
            return { id: docId, ...data };
        }

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        await _db.collection(collection).doc(docId).update({
            ...data,
            updatedAt: timestamp
        });

        return { id: docId, ...data };
    }

    /**
     * Delete a document
     */
    async function deleteDocument(collection, docId) {
        if (!_isOnline) {
            const store = getDemoStore();
            if (store[collection] && store[collection][docId]) {
                delete store[collection][docId];
                saveDemoStore(store);
                notifyLocalChange(collection, docId);
            }
            return true;
        }

        await _db.collection(collection).doc(docId).delete();
        return true;
    }

    // ── Realtime Listeners ──

    /**
     * Subscribe to a document
     */
    function onDocument(collection, docId, callback) {
        if (!_isOnline) {
            // Provide demo data once
            const demoData = getDemoData(collection, docId);
            if (demoData) callback(demoData);
            return () => {};
        }

        const unsubscribe = _db.collection(collection).doc(docId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        callback({ id: doc.id, ...doc.data() });
                    } else {
                        callback(null);
                    }
                },
                (error) => {
                    console.error(`[Firestore] Listen ${collection}/${docId} error:`, error);
                }
            );

        _listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Subscribe to a collection
     */
    function onCollection(collection, callback, options = {}) {
        if (!_isOnline) {
            const demoData = getDemoCollection(collection, options);
            callback(demoData);
            return () => {};
        }

        let query = _db.collection(collection);

        if (options.where) {
            for (const [field, op, value] of options.where) {
                query = query.where(field, op, value);
            }
        }

        if (options.orderBy) {
            query = query.orderBy(options.orderBy, options.orderDir || 'asc');
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const unsubscribe = query.onSnapshot(
            (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(docs);
            },
            (error) => {
                console.error(`[Firestore] Listen collection ${collection} error:`, error);
            }
        );

        _listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Unsubscribe all listeners
     */
    function unsubscribeAll() {
        _listeners.forEach(unsub => {
            try { unsub(); } catch(e) {}
        });
        _listeners = [];
    }

    // ── Storage helpers ──

    /**
     * Upload file (Supports Firebase Storage when online, and Base64 Data URL fallback in Demo mode)
     */
    async function uploadFile(path, file, onProgress) {
        if (!_isOnline || !firebase.storage) {
            // Demo mode: Return Base64 Data URL so upload works immediately
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('Gagal membaca file lokal.'));
                reader.readAsDataURL(file);
            });
        }

        const storageRef = firebase.storage().ref(path);
        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => {
                    console.error('[Storage] Upload error:', error);
                    reject(new Error('Gagal mengupload file. ' + error.message));
                },
                async () => {
                    try {
                        const url = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(url);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }

    /**
     * Delete file from Firebase Storage
     */
    async function deleteFile(path) {
        if (!_isOnline || !firebase.storage) {
            return true;
        }

        const storageRef = firebase.storage().ref(path);
        await storageRef.delete();
        return true;
    }

    function notifyLocalChange(collection, docId) {
        try {
            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { collection, docId } }));
            window.dispatchEvent(new Event('storage'));
        } catch(e) {}
    }

    function saveDemoStore(store) {
        try {
            localStorage.setItem('masjid_demo_store', JSON.stringify(store));
        } catch (e) {}
    }

    // ── Demo Data ──

    function getDemoData(collection, docId) {
        const demoStore = getDemoStore();
        if (demoStore[collection]) {
            if (docId && demoStore[collection][docId]) {
                return { id: docId, ...demoStore[collection][docId] };
            }
            // Return first item
            const keys = Object.keys(demoStore[collection]);
            if (keys.length > 0) {
                return { id: keys[0], ...demoStore[collection][keys[0]] };
            }
        }
        return null;
    }

    function getDemoCollection(collection, options = {}) {
        const demoStore = getDemoStore();
        if (!demoStore[collection]) return [];

        let items = Object.entries(demoStore[collection]).map(([id, data]) => ({
            id, ...data
        }));

        // Apply status filter
        if (options.where) {
            for (const [field, op, value] of options.where) {
                items = items.filter(item => {
                    const fieldVal = item[field];
                    switch(op) {
                        case '==': return fieldVal === value;
                        case '!=': return fieldVal !== value;
                        case '>': return fieldVal > value;
                        case '>=': return fieldVal >= value;
                        case '<': return fieldVal < value;
                        case '<=': return fieldVal <= value;
                        default: return true;
                    }
                });
            }
        }

        // Apply ordering
        if (options.orderBy) {
            items.sort((a, b) => {
                const aVal = a[options.orderBy] || 0;
                const bVal = b[options.orderBy] || 0;
                return options.orderDir === 'desc' ? bVal - aVal : aVal - bVal;
            });
        }

        if (options.limit) {
            items = items.slice(0, options.limit);
        }

        return items;
    }

    function getDemoStore() {
        const defaultStore = {
            settings: {
                mosque: {
                    name: 'Masjid Teraskota',
                    address: 'Pusat Ibadah, Dakwah & Pembinaan Umat, BSD City',
                    city: 'Tangerang Selatan',
                    logoUrl: 'assets/images/logo-masjid.svg',
                    phone: '021-537-8899',
                    email: 'dkm@masjidteraskota.id',
                    runningText: 'Selamat Datang di Masjid Teraskota • Lurus dan rapatkan saf saat salat berjamaah • Matikan atau heningkan nada dering telepon seluler di dalam masjid • Jagalah kebersihan dan kesucian rumah Allah SWT.',
                    slideDuration: 8,
                    hijriAdjustment: 0
                },
                background: {
                    type: 'default',
                    url: '',
                    opacity: 0.65
                },
                prayerConfig: {
                    latitude: -6.3000,
                    longitude: 106.6700,
                    method: 20,
                    city: 'Tangerang Selatan'
                }
            },
            kajian: {
                'demo-kajian-1': {
                    title: 'Kajian Fiqih Ibadah',
                    speaker: 'Ustadz Ahmad Faiz, Lc.',
                    day: 'Senin',
                    time: '19:30',
                    location: 'Masjid Teraskota',
                    description: 'Pembahasan kitab fiqih ibadah sehari-hari',
                    isActive: true,
                    order: 1
                },
                'demo-kajian-2': {
                    title: 'Kajian Tafsir Al-Quran',
                    speaker: 'Ustadz Muhammad Ridwan, M.A.',
                    day: 'Rabu',
                    time: '06:00',
                    location: 'Masjid Teraskota',
                    description: 'Tadabbur dan tafsir Al-Quran',
                    isActive: true,
                    order: 2
                },
                'demo-kajian-3': {
                    title: 'Kajian Sirah Nabawiyah',
                    speaker: 'Ustadz Hasan Basri, S.Pd.I',
                    day: 'Jumat',
                    time: '08:00',
                    location: 'Masjid Teraskota',
                    description: 'Meneladani kehidupan Rasulullah SAW',
                    isActive: true,
                    order: 3
                }
            },
            activities: {
                'demo-activity-1': {
                    title: 'Bersih-Bersih Masjid',
                    date: '2026-11-01',
                    time: '07:00',
                    description: 'Gotong royong membersihkan dan merawat masjid',
                    isActive: true,
                    order: 1
                },
                'demo-activity-2': {
                    title: 'Santunan Anak Yatim',
                    date: '2026-11-15',
                    time: '09:00',
                    description: 'Program santunan bulanan untuk anak yatim di sekitar masjid',
                    isActive: true,
                    order: 2
                }
            },
            announcements: {
                'demo-announcement-1': {
                    title: 'Pendaftaran TPA Semester Baru',
                    content: 'Pendaftaran TPA Al-Hikmah untuk semester baru telah dibuka. Silakan hubungi pengurus masjid untuk informasi lebih lanjut.',
                    isActive: true,
                    isPriority: true,
                    order: 1
                },
                'demo-announcement-2': {
                    title: 'Renovasi Area Wudhu',
                    content: 'Akan dilaksanakan renovasi area wudhu mulai bulan depan. Mohon maaf atas ketidaknyamanan selama proses renovasi berlangsung.',
                    isActive: true,
                    isPriority: false,
                    order: 2
                }
            },
            news: {
                'demo-news-1': {
                    title: 'Peringatan Maulid Nabi Muhammad SAW',
                    content: 'Masjid Teraskota akan menyelenggarakan peringatan Maulid Nabi dengan rangkaian acara ceramah dan dzikir bersama.',
                    date: '2026-11-10',
                    isActive: true,
                    order: 1
                }
            },
            fridaySchedules: {
                'demo-friday-1': {
                    date: '2026-10-30',
                    khatib: 'Ustadz Ahmad Faiz, Lc.',
                    imam: 'Ustadz Ahmad Faiz, Lc.',
                    muazin: 'Bpk. Hasan',
                    tema: 'Keutamaan Sholat Berjamaah',
                    isActive: true
                }
            },
            financeReports: {
                'demo-finance-1': {
                    period: 'Oktober 2026',
                    pemasukan: 15750000,
                    pengeluaran: 8320000,
                    saldo: 45680000,
                    infaq: 12500000,
                    zakat: 2350000,
                    wakaf: 900000,
                    isActive: true,
                    order: 1
                }
            },
            qris: {
                'demo-qris-1': {
                    label: 'QRIS Infaq Masjid Teraskota',
                    imageUrl: '',
                    isActive: true
                }
            },
            displaySlides: {
                'config': {
                    slideOrder: ['kajian', 'announcements', 'activities', 'friday', 'news', 'finance', 'qris'],
                    defaultDuration: 8,
                    transitionType: 'fade',
                    backgroundUrl: ''
                }
        };

        try {
            const saved = localStorage.getItem('masjid_demo_store');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...defaultStore,
                    ...parsed,
                    settings: {
                        ...defaultStore.settings,
                        ...(parsed.settings || {})
                    }
                };
            }
        } catch (e) {}

        return defaultStore;
    }

    return {
        init,
        isOnline,
        getDocument,
        getCollection,
        setDocument,
        addDocument,
        updateDocument,
        deleteDocument,
        onDocument,
        onCollection,
        unsubscribeAll,
        uploadFile,
        deleteFile
    };
})();

window.FirestoreService = FirestoreService;
