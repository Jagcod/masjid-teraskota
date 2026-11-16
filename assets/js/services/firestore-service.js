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
                
                // Enable offline persistence non-blocking
                _db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                    console.info('[Firestore] Offline persistence note:', err.code || err.message);
                });

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

    // ── Firestore REST API Helper (Ultra Cepat ~200ms & Kebal Blokir Jaringan) ──
    function parseFirestoreRestFields(fields) {
        if (!fields) return {};
        const res = {};
        for (const [key, valObj] of Object.entries(fields)) {
            if (valObj.stringValue !== undefined) res[key] = valObj.stringValue;
            else if (valObj.booleanValue !== undefined) res[key] = valObj.booleanValue;
            else if (valObj.integerValue !== undefined) res[key] = parseInt(valObj.integerValue, 10);
            else if (valObj.doubleValue !== undefined) res[key] = parseFloat(valObj.doubleValue);
            else if (valObj.timestampValue !== undefined) res[key] = valObj.timestampValue;
            else if (valObj.arrayValue !== undefined) {
                res[key] = (valObj.arrayValue.values || []).map(v => {
                    if (v.stringValue !== undefined) return v.stringValue;
                    if (v.mapValue !== undefined) return parseFirestoreRestFields(v.mapValue.fields);
                    return v;
                });
            } else if (valObj.mapValue !== undefined) {
                res[key] = parseFirestoreRestFields(valObj.mapValue.fields);
            } else if (valObj.nullValue !== undefined) {
                res[key] = null;
            }
        }
        return res;
    }

    async function fetchCollectionRest(collection) {
        try {
            const projectId = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.projectId) || 'masjidtv-57edd';
            const url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + collection + '?pageSize=100';
            const resp = await fetch(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data.documents || !data.documents.length) return [];
            return data.documents.map(doc => {
                const id = doc.name.split('/').pop();
                const fields = parseFirestoreRestFields(doc.fields);
                return { id, ...fields };
            });
        } catch (e) {
            console.warn('[Firestore REST Fallback] Collection ' + collection + ' error:', e.message);
            return [];
        }
    }

    async function fetchDocumentRest(collection, docId) {
        try {
            const projectId = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.projectId) || 'masjidtv-57edd';
            const url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/' + collection + '/' + docId;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const doc = await resp.json();
            if (!doc || !doc.fields) return null;
            const fields = parseFirestoreRestFields(doc.fields);
            return { id: docId, ...fields };
        } catch (e) {
            console.warn('[Firestore REST Fallback] Document ' + collection + '/' + docId + ' error:', e.message);
            return null;
        }
    }

    // ── CRUD Operations ──

    /**
     * Get a single document (Cache First -> SDK -> Fast REST Fallback)
     */
    async function getDocument(collection, docId) {
        if (!docId || String(docId).startsWith('local_')) {
            return getDemoData(collection, docId);
        }

        // 1. Coba ambil dari Cache Instan (0 ms)
        let cachedDoc = null;
        try {
            const cStr = localStorage.getItem('masjid_cache_doc_' + collection + '_' + docId);
            if (cStr) cachedDoc = JSON.parse(cStr);
        } catch(e) {}

        if (!_isOnline) {
            return cachedDoc || getDemoData(collection, docId);
        }

        try {
            // Coba SDK dengan timeout singkat 2 detik
            const getPromise = _db.collection(collection).doc(docId).get();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SDK timeout')), 2000));
            const doc = await Promise.race([getPromise, timeoutPromise]);
            if (doc.exists) {
                const res = { id: doc.id, ...doc.data() };
                try { localStorage.setItem('masjid_cache_doc_' + collection + '_' + docId, JSON.stringify(res)); } catch(e) {}
                return res;
            }
        } catch (error) {
            console.warn('[Firestore] SDK getDocument ' + collection + '/' + docId + ' slow/failed, using REST API:', error.message);
        }

        // 2. Fallback instan ke REST API Google (~200ms)
        const restDoc = await fetchDocumentRest(collection, docId);
        if (restDoc) {
            try { localStorage.setItem('masjid_cache_doc_' + collection + '_' + docId, JSON.stringify(restDoc)); } catch(e) {}
            return restDoc;
        }

        return cachedDoc || getDemoData(collection, docId);
    }

    /**
     * Get all documents from a collection (Instant Local Cache + Fast REST Fallback)
     */
    async function getCollection(collection, options = {}) {
        // 1. Cache Instan dari LocalStorage (Data langsung muncul 0 milidetik!)
        let cachedItems = null;
        try {
            const cachedStr = localStorage.getItem('masjid_cache_col_' + collection);
            if (cachedStr) {
                cachedItems = JSON.parse(cachedStr);
            }
        } catch(e) {}

        if (!_isOnline) {
            return cachedItems || getDemoCollection(collection, options);
        }

        let cloudDocs = null;

        // 2. Coba fetch via Firebase SDK (Timeout 2 detik agar tidak pernah nunggu lama)
        try {
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

            const getPromise = query.get();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SDK timeout')), 2000));
            const snapshot = await Promise.race([getPromise, timeoutPromise]);
            cloudDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn('[Firestore] SDK getCollection ' + collection + ' slow/failed, using REST API fallback:', error.message);
        }

        // 3. Jika SDK timeout atau gagal, LANGSUNG ambil dari REST API Google (~200ms)
        if (!cloudDocs) {
            cloudDocs = await fetchCollectionRest(collection);
            // Terapkan client-side filter jika ada options.where
            if (options.where && options.where.length > 0) {
                cloudDocs = cloudDocs.filter(doc => {
                    return options.where.every(([f, op, val]) => {
                        if (op === '==') return doc[f] === val;
                        return true;
                    });
                });
            }
        }

        // Gabungkan dengan dokumen lokal temporary jika ada
        const demoDocs = getDemoCollection(collection, options);
        const localOnlyDocs = demoDocs.filter(d => String(d.id).startsWith('local_'));
        let combined = [...(cloudDocs || [])];
        localOnlyDocs.forEach(loc => {
            if (!combined.some(c => c.id === loc.id)) {
                combined.push(loc);
            }
        });

        // 4. Update cache LocalStorage agar buka berikutnya instan
        if (combined && combined.length >= 0) {
            try {
                localStorage.setItem('masjid_cache_col_' + collection, JSON.stringify(combined));
            } catch(e) {}
        }

        return combined.length > 0 ? combined : (cachedItems || []);
    }

    /**
     * Set/create a document (overwrites)
     */
    async function setDocument(collection, docId, data) {
        // Simpan selalu ke penyimpanan lokal sebagai fallback instan
        try {
            const store = getDemoStore();
            if (!store[collection]) store[collection] = {};
            store[collection][docId] = {
                ...store[collection][docId],
                ...data,
                updatedAt: new Date().toISOString()
            };
            saveDemoStore(store);
            notifyLocalChange(collection, docId);
        } catch(e) {}

        if (!_isOnline) {
            return { id: docId, ...data };
        }

        try {
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const docData = {
                ...data,
                updatedAt: timestamp
            };

            if (!data.createdAt) {
                docData.createdAt = timestamp;
            }

            const setPromise = _db.collection(collection).doc(docId).set(docData, { merge: true });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore setDocument timeout')), 5000));
            await Promise.race([setPromise, timeoutPromise]);
            return { id: docId, ...data };
        } catch (error) {
            console.warn(`[Firestore] setDocument ${collection}/${docId} error:`, error.message);
            if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission'))) {
                throw new Error('Akses ditolak database Firebase (Permission Denied). Buka Firebase Console > Firestore Database > Rules, ubah menjadi "allow read, write: if true;" agar tersinkron ke semua perangkat (TV & Laptop).');
            }
            return { id: docId, ...data };
        }
    }

    /**
     * Add a new document (auto-ID)
     */
    async function addDocument(collection, data) {
        const localDocId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // Simpan ke lokal dulu secara instan
        try {
            const store = getDemoStore();
            if (!store[collection]) store[collection] = {};
            const timestamp = new Date().toISOString();
            store[collection][localDocId] = {
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp
            };
            saveDemoStore(store);
            notifyLocalChange(collection, localDocId);
        } catch(e) {}

        if (!_isOnline) {
            return { id: localDocId, ...data };
        }

        try {
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const docData = {
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            const addPromise = _db.collection(collection).add(docData);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore add timeout')), 5000));
            const ref = await Promise.race([addPromise, timeoutPromise]);
            
            // Simpan juga dengan ID asli dari Firestore ke local demo store
            try {
                const store = getDemoStore();
                if (store[collection]) {
                    delete store[collection][localDocId];
                    store[collection][ref.id] = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                    saveDemoStore(store);
                }
            } catch(e) {}

            return { id: ref.id, ...data };
        } catch (error) {
            console.warn(`[Firestore] addDocument ${collection} error:`, error.message);
            if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission'))) {
                throw new Error('Akses ditolak database Firebase (Permission Denied). Harap ubah Rules di Firebase Console menjadi "allow read, write: if true;".');
            }
            return { id: localDocId, ...data };
        }
    }

    /**
     * Update a document (partial update)
     */
    async function updateDocument(collection, docId, data) {
        // Simpan ke lokal dulu
        try {
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
        } catch(e) {}

        if (!_isOnline || String(docId).startsWith('local_')) {
            return { id: docId, ...data };
        }

        try {
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const updatePromise = _db.collection(collection).doc(docId).update({
                ...data,
                updatedAt: timestamp
            });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore update timeout')), 5000));
            await Promise.race([updatePromise, timeoutPromise]);
            return { id: docId, ...data };
        } catch (error) {
            console.warn(`[Firestore] updateDocument ${collection}/${docId} error:`, error.message);
            if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission'))) {
                throw new Error('Akses ditolak database Firebase (Permission Denied). Harap ubah Rules di Firebase Console menjadi "allow read, write: if true;".');
            }
            return { id: docId, ...data };
        }
    }

    /**
     * Delete a single document
     */
    async function deleteDocument(collection, docId) {
        // Hapus lokal seketika (Optimistic update 0 ms)
        try {
            const store = getDemoStore();
            if (store[collection] && store[collection][docId]) {
                delete store[collection][docId];
                saveDemoStore(store);
                notifyLocalChange(collection, docId);
            }
        } catch(e) {}

        if (!_isOnline || String(docId).startsWith('local_')) {
            return true;
        }

        try {
            const deletePromise = _db.collection(collection).doc(docId).delete();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore delete timeout')), 2500));
            await Promise.race([deletePromise, timeoutPromise]);
            return true;
        } catch (error) {
            console.warn(`[Firestore] deleteDocument ${collection}/${docId} notice:`, error.message);
            return true;
        }
    }

    /**
     * Delete multiple documents simultaneously (Fast Batch Delete)
     */
    async function deleteDocuments(collection, docIds) {
        if (!docIds || !docIds.length) return true;

        // 1. Hapus dari cache lokal seketika (0 ms UI lag)
        try {
            const store = getDemoStore();
            if (store[collection]) {
                docIds.forEach(id => {
                    delete store[collection][id];
                });
                saveDemoStore(store);
                notifyLocalChange(collection, docIds[0]);
            }
        } catch(e) {}

        if (!_isOnline) {
            return true;
        }

        // 2. Eksekusi batch delete di Firebase Firestore
        try {
            const batch = _db.batch();
            let count = 0;
            docIds.forEach(id => {
                if (!String(id).startsWith('local_')) {
                    const ref = _db.collection(collection).doc(id);
                    batch.delete(ref);
                    count++;
                }
            });

            if (count > 0) {
                const commitPromise = batch.commit();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore batch delete timeout')), 3500));
                await Promise.race([commitPromise, timeoutPromise]);
            }
            return true;
        } catch (error) {
            console.warn(`[Firestore] Batch delete error, falling back to parallel:`, error.message);
            await Promise.all(docIds.map(id => deleteDocument(collection, id)));
            return true;
        }
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
     * Upload file (Supports Firebase Storage with instant fallback to Base64)
     */
    async function uploadFile(path, file, onProgress) {
        if (!_isOnline || !firebase.storage) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }

        // Jalankan upload dengan proteksi timeout 3.5 detik agar form tidak pernah macet
        const uploadPromise = new Promise((resolve, reject) => {
            try {
                const storageRef = firebase.storage().ref(path);
                const uploadTask = storageRef.put(file);

                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) onProgress(progress);
                    },
                    (error) => {
                        console.warn('[Storage] Upload task error, fallback base64:', error.message);
                        reject(error);
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
            } catch (err) {
                reject(err);
            }
        });

        // Timeout 1.5 detik: jika storage belum diaktifkan di Firebase Console, fallback ke Base64 seketika
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Storage upload timeout, fallback to base64')), 1500)
        );

        try {
            return await Promise.race([uploadPromise, timeoutPromise]);
        } catch (e) {
            console.info('[Storage] Menggunakan gambar lokal terkompresi:', e.message);
            // Kembalikan base64 agar data tetap tersimpan lancar
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }
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
            // Write to localStorage to trigger the browser's native 'storage' event across ALL other tabs
            localStorage.setItem('masjid_sync_trigger', JSON.stringify({ collection, docId, time: Date.now() }));
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
                const aVal = (a[options.orderBy] !== undefined && a[options.orderBy] !== null ? a[options.orderBy] : '');
                const bVal = (b[options.orderBy] !== undefined && b[options.orderBy] !== null ? b[options.orderBy] : '');
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return options.orderDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                }
                return options.orderDir === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
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
                    logoUrl: 'assets/images/logo-masjid.png',
                    phone: '021-537-8899',
                    email: 'dkm@masjidteraskota.id',
                    runningText: 'Selamat Datang di Masjid Teraskota • Luruskan dan rapatkan saf saat salat berjamaah • Matikan nada dering handphone di dalam masjid • Jagalah kebersihan rumah Allah SWT.',
                    slideDuration: 10,
                    hijriAdjustment: 0,
                    timezone: 'Asia/Jakarta',
                    timezoneLabel: 'WIB (JAKARTA)'
                },
                background: {
                    type: 'default',
                    url: '',
                    opacity: 0.65,
                    fitMode: 'contain'
                },
                prayerConfig: {
                    latitude: -6.3000,
                    longitude: 106.6700,
                    method: 20,
                    city: 'Tangerang Selatan',
                    timezone: 'Asia/Jakarta',
                    timezoneLabel: 'WIB (JAKARTA)'
                },
                prayerOverrides: {
                    enabled: false,
                    times: {
                        imsak: '04:18',
                        subuh: '04:28',
                        terbit: '05:43',
                        dhuha: '06:05',
                        dzuhur: '11:49',
                        ashar: '15:05',
                        maghrib: '17:51',
                        isya: '19:01'
                    }
                },
                tarawih: {
                    enabled: false,
                    title: 'Jadwal Imam & Bilal Salat Tarawih 1448 H',
                    yearHijri: '1448 H / 2026 M',
                    nights: Array.from({ length: 30 }, (_, i) => ({
                        night: i + 1,
                        imam: i % 2 === 0 ? 'Ustadz Ahmad Faiz, Lc.' : 'Ustadz Muhammad Ridwan, M.A.',
                        bilal: i % 2 === 0 ? 'Bpk. Bilal Hasan' : 'Sdr. Farhan'
                    }))
                }
            },
            kajian: {
                'demo-kajian-1': {
                    title: 'Kajian Fiqih Ibadah Praktis',
                    speaker: 'Ustadz Ahmad Faiz, Lc.',
                    day: 'Senin',
                    time: '19:30',
                    location: 'Ruang Utama Masjid',
                    description: 'Pembahasan kitab fiqih ibadah sehari-hari dan tanya jawab',
                    imageUrl: 'assets/images/poster-kajian.svg',
                    isActive: true,
                    order: 1
                },
                'demo-kajian-2': {
                    title: 'Tadabbur Al-Quran & Sirah',
                    speaker: 'Ustadz Muhammad Ridwan, M.A.',
                    day: 'Rabu',
                    time: '06:00',
                    location: 'Ruang Utama Masjid',
                    description: 'Kajian subuh tematik tafsir ayat pilihan',
                    isActive: true,
                    order: 2
                },
                'demo-kajian-3': {
                    title: 'Kajian Tazkiyatun Nafs',
                    speaker: 'Ustadz Hasan Basri, S.Pd.I',
                    day: 'Jumat',
                    time: '08:00',
                    location: 'Aula Masjid Teraskota',
                    description: 'Pembersihan jiwa dan akhlak islami',
                    isActive: true,
                    order: 3
                }
            },
            activities: {
                'demo-activity-1': {
                    title: 'Kajian Akbar: Meraih Manisnya Iman',
                    date: 'Ahad, 15 November 2026',
                    time: '09:00',
                    speaker: 'Ustadz Dr. Syafiq Riza Basalamah, M.A.',
                    location: 'Ruang Utama & Pelataran Masjid',
                    description: 'Kajian umum terbuka untuk ikhwan dan akhwat, disiarkan langsung di YouTube DKM Teraskota.',
                    imageUrl: 'assets/images/poster-kajian.svg',
                    isActive: true,
                    order: 1
                },
                'demo-activity-2': {
                    title: 'Santunan Akbar & Khitanan Massal',
                    date: 'Ahad, 22 November 2026',
                    time: '08:00',
                    speaker: 'Tim Medis RS Islam & DKM',
                    location: 'Gedung Serbaguna Masjid',
                    description: 'Program bakti sosial pembagian sembako dan santunan santri yatim dhuafa.',
                    imageUrl: 'assets/images/poster-khitan.svg',
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
                    date: '2026-11-06',
                    khatib: 'Ustadz Dr. H. Ahsin Sakho',
                    imam: 'Ustadz Ahmad Faiz, Lc.',
                    muazin: 'Bpk. Bilal Hasan',
                    tema: 'Meraih Keberkahan Sholat Berjamaah',
                    isActive: true
                },
                'demo-friday-2': {
                    date: '2026-11-13',
                    khatib: 'Ustadz Muhammad Ridwan, M.A.',
                    imam: 'Ustadz Hasan Basri, S.Pd.I',
                    muazin: 'Sdr. Farhan',
                    tema: 'Membangun Generasi Rabbani',
                    isActive: true
                },
                'demo-friday-3': {
                    date: '2026-11-20',
                    khatib: 'Ustadz Dr. Syafiq Riza Basalamah',
                    imam: 'Ustadz Ahmad Faiz, Lc.',
                    muazin: 'Bpk. Bilal Hasan',
                    tema: 'Menjaga Hati dan Lisan',
                    isActive: true
                },
                'demo-friday-4': {
                    date: '2026-11-27',
                    khatib: 'Ustadz Prof. Dr. Nasaruddin Umar',
                    imam: 'Ustadz H. Abdul Somad',
                    muazin: 'Sdr. Farhan',
                    tema: 'Ukhuwah Islamiyah Perekat Umat',
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
            }
        };

        // Jika Firebase sudah dikonfigurasi, kosongkan data demo default agar tidak pernah menghidupkan kembali data kajian lama
        const hasRealFirebase = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured();
        if (hasRealFirebase) {
            defaultStore.kajian = {};
            defaultStore.activities = {};
            defaultStore.announcements = {};
            defaultStore.news = {};
            defaultStore.fridaySchedules = {};
            defaultStore.financeReports = {};
            defaultStore.qris = {};
            defaultStore.slideContent = {};
        }

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
        deleteDocuments,
        onDocument,
        onCollection,
        listenDocument: onDocument,
        listenCollection: onCollection,
        unsubscribeAll,
        uploadFile,
        deleteFile
    };
})();

window.FirestoreService = FirestoreService;
