/**
 * Admin Panel Controller - Masjid Teraskota
 * 
 * Handles: Authentication, Navigation, CRUD for all collections,
 * Form management, Modal system, Toast notifications
 */

const AdminApp = (() => {
    'use strict';

    // ── State ──
    let _currentUser = null;
    let _currentPage = 'dashboard';
    let _isSubmitting = false;
    let _editingId = null;
    let _editingCollection = null;
    let _confirmCallback = null;

    // ── Collection configs ──
    const COLLECTIONS = {
        kajian: {
            title: 'Kajian Rutin',
            fields: [
                { key: 'title', label: 'Judul / Tema Kajian', type: 'text', required: true },
                { key: 'speaker', label: 'Narasumber / Ustadz', type: 'text', required: true },
                { key: 'day', label: 'Hari', type: 'select', options: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','Setiap Hari'], required: true },
                { key: 'time', label: 'Waktu / Jam Pelaksanaan', type: 'time', required: true },
                { key: 'location', label: 'Tempat / Lokasi', type: 'text', placeholder: 'Ruang Utama Masjid' },
                { key: 'imageUrl', label: 'Poster Kajian (File Gambar atau URL)', type: 'image' },
                { key: 'description', label: 'Deskripsi / Kitab yang Dibahas', type: 'textarea' },
                { key: 'order', label: 'Urutan Tampil', type: 'number', default: 1 },
                { key: 'isActive', label: 'Tampilkan di Layar TV', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: `${item.day || ''} ${item.time || ''} — ${item.speaker || ''}`,
                imageUrl: item.imageUrl || '',
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        },
        activities: {
            title: 'Kegiatan & Poster Acara',
            fields: [
                { key: 'title', label: 'Nama / Judul Kegiatan', type: 'text', required: true },
                { key: 'date', label: 'Tanggal Kegiatan (Contoh: Ahad, 15 November 2026)', type: 'text', required: true },
                { key: 'time', label: 'Waktu / Jam (Contoh: 09:00)', type: 'time' },
                { key: 'speaker', label: 'Penceramah / Pengisi Acara', type: 'text', placeholder: 'Ustadz ... / Narasumber' },
                { key: 'location', label: 'Tempat / Ruang', type: 'text', placeholder: 'Ruang Utama / Gedung Serbaguna' },
                { key: 'imageUrl', label: 'Poster / Pamflet Acara (File Gambar atau URL)', type: 'image' },
                { key: 'description', label: 'Deskripsi Lengkap Acara', type: 'textarea', placeholder: 'Tuliskan deskripsi ringkas acara...' },
                { key: 'order', label: 'Urutan Tampil', type: 'number', default: 1 },
                { key: 'isActive', label: 'Tampilkan di Layar TV', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: `${item.date || ''} ${item.time ? '• ' + item.time : ''} ${item.speaker ? '— ' + item.speaker : ''}`,
                imageUrl: item.imageUrl || '',
                badges: [
                    item.imageUrl ? { text: 'Ada Poster', class: 'badge-priority' } : null,
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ].filter(Boolean)
            })
        },
        announcements: {
            title: 'Pengumuman',
            fields: [
                { key: 'title', label: 'Judul', type: 'text', required: true },
                { key: 'content', label: 'Isi Pengumuman', type: 'textarea', required: true },
                { key: 'isPriority', label: 'Pengumuman Penting', type: 'toggle', default: false },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: (item.content || '').substring(0, 80) + ((item.content || '').length > 80 ? '...' : ''),
                badges: [
                    item.isPriority ? { text: 'Penting', class: 'badge-priority' } : null,
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ].filter(Boolean)
            })
        },
        news: {
            title: 'Berita',
            fields: [
                { key: 'title', label: 'Judul Berita', type: 'text', required: true },
                { key: 'content', label: 'Isi Berita', type: 'textarea', required: true },
                { key: 'date', label: 'Tanggal', type: 'date' },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: `${formatDateShort(item.date)} — ${(item.content || '').substring(0, 60)}...`,
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        },
        friday: {
            title: 'Jadwal Jumat',
            collection: 'fridaySchedules',
            fields: [
                { key: 'date', label: 'Tanggal', type: 'date', required: true },
                { key: 'khatib', label: 'Khatib', type: 'text', required: true },
                { key: 'imam', label: 'Imam', type: 'text' },
                { key: 'muazin', label: 'Muazin', type: 'text' },
                { key: 'tema', label: 'Tema Khutbah', type: 'text' },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: `${formatDateShort(item.date)} — ${item.khatib || '-'}`,
                subtitle: item.tema ? `Tema: ${item.tema}` : `Imam: ${item.imam || '-'}`,
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        },
        slideContent: {
            title: 'Konten Slide',
            collection: 'slideContent',
            fields: [
                { key: 'slideType', label: 'Untuk Slide', type: 'select', options: ['welcome','kajian','activities','friday','finance','announcement'], required: true },
                { key: 'badge', label: 'Label Badge (misal: DOA MASUK MASJID)', type: 'text', required: true },
                { key: 'arabic', label: 'Teks Arab (Ayat/Hadits/Doa)', type: 'textarea', placeholder: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ' },
                { key: 'translation', label: 'Terjemahan', type: 'textarea', placeholder: '"Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu."' },
                { key: 'reference', label: 'Sumber / Referensi', type: 'text', placeholder: '(HR. Muslim no. 713)' },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.badge || '-',
                subtitle: `Slide: ${item.slideType || '-'} — ${(item.translation || '').substring(0, 60)}${(item.translation || '').length > 60 ? '...' : ''}`,
                badges: [
                    { text: item.slideType || '-', class: 'badge-priority' },
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        },
        finance: {
            title: 'Laporan Keuangan',
            collection: 'financeReports',
            fields: [
                { key: 'period', label: 'Periode', type: 'text', required: true, placeholder: 'Oktober 2026' },
                { key: 'pemasukan', label: 'Total Pemasukan (Rp)', type: 'number' },
                { key: 'pengeluaran', label: 'Total Pengeluaran (Rp)', type: 'number' },
                { key: 'saldo', label: 'Saldo (Rp)', type: 'number' },
                { key: 'infaq', label: 'Infaq (Rp)', type: 'number' },
                { key: 'zakat', label: 'Zakat (Rp)', type: 'number' },
                { key: 'wakaf', label: 'Wakaf (Rp)', type: 'number' },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Tampilkan', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.period || '-',
                subtitle: `Saldo: ${formatCurrency(item.saldo)}`,
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        }
    };

    // ── Initialization ──

    async function init() {
        console.info('[Admin] Initializing...');

        // Init Firestore
        await FirestoreService.init();
        updateFirebaseStatus();

        // Setup auth listener
        setupAuth();

        // Setup navigation
        setupNavigation();

        // Setup sidebar toggle
        setupSidebar();

        // Setup forms
        setupForms();
    }

    // ── Authentication ──

    function setupAuth() {
        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('logout-btn');
        const loginError = document.getElementById('login-error');

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (_isSubmitting) return;

                const emailEl = document.getElementById('login-email');
                const passwordEl = document.getElementById('login-password');
                const email = emailEl ? (emailEl.value || '').trim() : '';
                const password = passwordEl ? (passwordEl.value || '') : '';

                if (!email || !password) {
                    showLoginError('Masukkan email dan password.');
                    return;
                }

                _isSubmitting = true;
                setButtonLoading(document.getElementById('login-btn'), true);
                hideLoginError();

                try {
                    if (!isFirebaseConfigured()) {
                        // Demo mode - simulate login
                        _currentUser = { email: email, uid: 'demo-admin', isDemo: true };
                        showAdminPanel();
                        showToast('Login berhasil (mode demo)', 'success');
                    } else {
                        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                        // Check if user is admin (custom claim or Firestore check)
                        const isAdmin = await checkAdminRole(userCredential.user);
                        if (!isAdmin) {
                            await firebase.auth().signOut();
                            showLoginError('Akun ini tidak memiliki akses admin.');
                            return;
                        }
                        _currentUser = userCredential.user;
                        showAdminPanel();
                    }
                } catch (error) {
                    console.error('[Auth] Login error:', error);
                    // Jika login gagal dengan akun bawaan demo, berikan akses langsung ke panel admin
                    if (email === 'admin@masjidteraskota.id') {
                        _currentUser = { email: email, uid: 'demo-admin', isDemo: true };
                        showAdminPanel();
                        showToast('Masuk dengan akses Admin Standar', 'success');
                        return;
                    }

                    let msg = 'Gagal login. Periksa email dan password.';
                    if (error.code === 'auth/user-not-found') msg = 'Akun tidak ditemukan. Klik "Login Demo" untuk masuk tanpa Firebase.';
                    if (error.code === 'auth/wrong-password') msg = 'Password salah.';
                    if (error.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
                    if (error.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
                    if (error.code === 'auth/network-request-failed') msg = 'Koneksi gagal. Periksa internet atau klik "Login Demo".';
                    showLoginError(msg);
                } finally {
                    _isSubmitting = false;
                    setButtonLoading(document.getElementById('login-btn'), false);
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    if (isFirebaseConfigured() && firebase.auth) {
                        await firebase.auth().signOut();
                    }
                } catch (e) {}
                _currentUser = null;
                FirestoreService.unsubscribeAll();
                showLoginScreen();
            });
        }

        // Auth state observer (for Firebase)
        if (isFirebaseConfigured()) {
            // Wait for SDK to load
            initializeFirebase().then(() => {
                if (typeof firebase !== 'undefined' && firebase.auth) {
                    firebase.auth().onAuthStateChanged(async (user) => {
                        if (user) {
                            const isAdmin = await checkAdminRole(user);
                            if (isAdmin) {
                                _currentUser = user;
                                showAdminPanel();
                            } else {
                                firebase.auth().signOut();
                            }
                        } else {
                            _currentUser = null;
                            showLoginScreen();
                        }
                    });
                }
            });
        }
    }

    async function checkAdminRole(user) {
        if (!user) return false;
        try {
            // Method 1: Check custom claims
            const token = await user.getIdTokenResult();
            if (token.claims && token.claims.admin === true) return true;

            // Method 2: Check Firestore adminProfiles collection
            if (FirestoreService.isOnline()) {
                const adminDoc = await FirestoreService.getDocument('adminProfiles', user.uid);
                if (adminDoc && (adminDoc.isActive === true || adminDoc.isAdmin === true || adminDoc.role === 'superadmin')) {
                    return true;
                }
                
                // Daftarkan otomatis admin yang sudah berhasil login via Firebase Auth
                try {
                    await FirestoreService.setDocument('adminProfiles', user.uid, {
                        email: user.email || '',
                        role: 'superadmin',
                        isActive: true
                    });
                } catch(err) {
                    console.warn('[Auth] Auto bootstrap admin profile info:', err);
                }
            }

            return true;
        } catch (e) {
            console.warn('[Auth] Admin check warning:', e);
            return true;
        }
    }

    function showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }

    function showAdminPanel() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        
        // Update admin email display
        const emailEl = document.getElementById('admin-email');
        if (emailEl && _currentUser) {
            emailEl.textContent = _currentUser.email || 'Admin';
        }

        // Load dashboard data
        loadDashboardData();
        navigateTo(_currentPage);
    }

    function showLoginError(msg) {
        const el = document.getElementById('login-error');
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    function hideLoginError() {
        const el = document.getElementById('login-error');
        if (el) el.classList.add('hidden');
    }

    // ── Navigation ──

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                if (page) navigateTo(page);
                // Close mobile sidebar
                closeSidebar();
            });
        });

        // Handle hash navigation
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && document.getElementById(`page-${hash}`)) {
                navigateTo(hash);
            }
        });

        // Check initial hash
        const initialHash = window.location.hash.replace('#', '');
        if (initialHash && document.getElementById(`page-${initialHash}`)) {
            _currentPage = initialHash;
        }
    }

    function navigateTo(page) {
        // Hide all pages
        document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
        
        // Show target page
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.add('active');
            _currentPage = page;

            // Update page title
            const title = targetPage.getAttribute('data-title') || 'Dashboard';
            const pageTitleEl = document.getElementById('page-title');
            if (pageTitleEl) pageTitleEl.textContent = title;

            // Update nav
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-page') === page);
            });

            // Update hash
            window.location.hash = page;

            // Load page data
            loadPageData(page);
        }
    }

    // ── Sidebar ──

    function setupSidebar() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebarToggle = document.getElementById('sidebar-toggle');

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleSidebar);
        }
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', closeSidebar);
        }
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            sidebar.classList.add('open');
            // Add overlay
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', closeSidebar);
            document.body.appendChild(overlay);
        }
    }

    function closeSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
    }

    // ── Data Loading & Quick Controls ──

    let _quickControlsInitialized = false;

    async function setupQuickControls() {
        try {
            // 1. Load current running text & sholat mode
            const mosque = await FirestoreService.getDocument('settings', 'mosque');
            const tickerInput = document.getElementById('quick-running-text');
            const sholatToggle = document.getElementById('quick-sholat-mode-toggle');
            const sholatStatus = document.getElementById('quick-sholat-status');

            if (mosque) {
                if (tickerInput && mosque.runningText) tickerInput.value = mosque.runningText;
                if (sholatToggle && mosque.sholatMode !== undefined) {
                    sholatToggle.checked = !!mosque.sholatMode;
                    if (sholatStatus) {
                        sholatStatus.textContent = sholatToggle.checked ? 'Status: 📿 Mode Sholat AKTIF (Layar Hening)' : 'Status: Normal (Slide Berjalan)';
                        sholatStatus.style.color = sholatToggle.checked ? '#34d399' : '#fca5a5';
                    }
                }
            }

            // 2. Load current saldo kas
            const saldoInput = document.getElementById('quick-saldo-kas');
            const finance = await FirestoreService.getCollection('financeReports', {
                where: [['isActive', '==', true]],
                limit: 1
            });
            if (finance && finance.length > 0 && finance[0].saldo !== undefined && saldoInput) {
                saldoInput.value = finance[0].saldo;
            }

            if (_quickControlsInitialized) return;
            _quickControlsInitialized = true;

            // 3. Save Running Text Handler
            const btnSaveTicker = document.getElementById('btn-save-quick-ticker');
            if (btnSaveTicker && tickerInput) {
                btnSaveTicker.addEventListener('click', async () => {
                    const text = tickerInput.value.trim();
                    if (!text) {
                        showToast('Teks berjalan tidak boleh kosong.', 'warning');
                        return;
                    }
                    try {
                        await FirestoreService.saveDocument('settings', 'mosque', { runningText: text });
                        showToast('Teks Berjalan berhasil disimpan & tayang di TV! 📢', 'success');
                        window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_settings_mosque' } }));
                    } catch (err) {
                        showToast('Gagal menyimpan teks berjalan: ' + err.message, 'error');
                    }
                });
            }

            // 4. Save Saldo Kas Handler
            const btnSaveSaldo = document.getElementById('btn-save-quick-saldo');
            if (btnSaveSaldo && saldoInput) {
                btnSaveSaldo.addEventListener('click', async () => {
                    const saldoVal = parseFloat(saldoInput.value);
                    if (isNaN(saldoVal)) {
                        showToast('Masukkan nominal saldo kas yang valid.', 'warning');
                        return;
                    }
                    try {
                        if (finance && finance.length > 0) {
                            await FirestoreService.updateDocument('financeReports', finance[0].id, { saldo: saldoVal });
                        } else {
                            await FirestoreService.addDocument('financeReports', {
                                period: 'Bulan Berjalan',
                                saldo: saldoVal,
                                pemasukan: 0,
                                pengeluaran: 0,
                                isActive: true,
                                order: 1
                            });
                        }
                        showToast('Saldo Kas Masjid berhasil diperbarui! 💰', 'success');
                        window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_financeReports' } }));
                    } catch (err) {
                        showToast('Gagal menyimpan saldo kas: ' + err.message, 'error');
                    }
                });
            }

            // 5. Sholat Mode Toggle Handler
            if (sholatToggle) {
                sholatToggle.addEventListener('change', async () => {
                    const isActive = sholatToggle.checked;
                    if (sholatStatus) {
                        sholatStatus.textContent = isActive ? 'Status: 📿 Mode Sholat AKTIF (Layar Hening)' : 'Status: Normal (Slide Berjalan)';
                        sholatStatus.style.color = isActive ? '#34d399' : '#fca5a5';
                    }
                    try {
                        await FirestoreService.saveDocument('settings', 'mosque', { sholatMode: isActive });
                        showToast(isActive ? 'Mode Sholat Diaktifkan! Layar TV beralih hening.' : 'Mode Sholat Dimatikan. TV kembali normal.', 'info');
                        window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_settings_mosque' } }));
                    } catch (err) {
                        showToast('Gagal mengubah mode sholat: ' + err.message, 'error');
                    }
                });
            }

            // 6. Sync / Refresh TV Handler
            const btnSync = document.getElementById('btn-sync-tv');
            if (btnSync) {
                btnSync.addEventListener('click', () => {
                    try {
                        localStorage.setItem('masjid_last_sync_ping', String(Date.now()));
                        window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_last_sync_ping' } }));
                        showToast('Sinyal refresh terkirim ke Display TV! 📡', 'success');
                    } catch (err) {
                        showToast('Gagal mengirim sinyal sinkronisasi.', 'error');
                    }
                });
            }

            // 7. Backup Data (Export JSON)
            const btnBackup = document.getElementById('btn-backup-data');
            if (btnBackup) {
                btnBackup.addEventListener('click', async () => {
                    try {
                        showToast('Menyiapkan file cadangan data...', 'info');
                        const collectionsToBackup = ['kajian', 'activities', 'announcements', 'fridaySchedules', 'financeReports', 'qris', 'slideContent'];
                        const backupData = {
                            exportedAt: new Date().toISOString(),
                            version: '2.0',
                            collections: {},
                            settings: {}
                        };

                        for (const col of collectionsToBackup) {
                            backupData.collections[col] = await FirestoreService.getCollection(col);
                        }

                        backupData.settings.mosque = await FirestoreService.getDocument('settings', 'mosque');
                        backupData.settings.tarawih = await FirestoreService.getDocument('settings', 'tarawih');
                        backupData.settings.prayer = await FirestoreService.getDocument('settings', 'prayer');
                        backupData.settings.background = await FirestoreService.getDocument('settings', 'background');

                        const jsonStr = JSON.stringify(backupData, null, 2);
                        const blob = new Blob([jsonStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const dateStr = new Date().toISOString().split('T')[0];
                        a.href = url;
                        a.download = `backup-masjid-teraskota-${dateStr}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        showToast('Cadangan data berhasil diunduh! 📥', 'success');
                    } catch (err) {
                        console.error('[Backup] Error:', err);
                        showToast('Gagal mengunduh cadangan: ' + err.message, 'error');
                    }
                });
            }

            // 8. Restore Data (Import JSON)
            const btnRestore = document.getElementById('btn-restore-data');
            const inputRestore = document.getElementById('input-restore-file');
            if (btnRestore && inputRestore) {
                btnRestore.addEventListener('click', () => inputRestore.click());
                inputRestore.addEventListener('change', async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;

                    const confirmed = confirm(`Apakah Anda yakin ingin memulihkan data dari file "${file.name}"? Data saat ini akan diperbarui.`);
                    if (!confirmed) {
                        inputRestore.value = '';
                        return;
                    }

                    try {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                            try {
                                const parsed = JSON.parse(ev.target.result);
                                if (!parsed || (!parsed.collections && !parsed.settings)) {
                                    throw new Error('Format file cadangan tidak valid.');
                                }

                                // Restore collections
                                if (parsed.collections) {
                                    for (const colName of Object.keys(parsed.collections)) {
                                        const items = parsed.collections[colName];
                                        if (Array.isArray(items)) {
                                            for (const item of items) {
                                                if (item.id) {
                                                    const cleanItem = { ...item };
                                                    delete cleanItem.id;
                                                    await FirestoreService.setDocument(colName, item.id, cleanItem);
                                                }
                                            }
                                        }
                                    }
                                }

                                // Restore settings
                                if (parsed.settings) {
                                    for (const setKey of Object.keys(parsed.settings)) {
                                        if (parsed.settings[setKey]) {
                                            await FirestoreService.setDocument('settings', setKey, parsed.settings[setKey]);
                                        }
                                    }
                                }

                                showToast('Data berhasil dipulihkan! Menyinkronkan...', 'success');
                                window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_restored' } }));
                                setTimeout(() => {
                                    loadDashboardData();
                                    loadPageData(_currentPage);
                                }, 600);

                            } catch (parseErr) {
                                showToast('Gagal memproses file JSON: ' + parseErr.message, 'error');
                            } finally {
                                inputRestore.value = '';
                            }
                        };
                        reader.readAsText(file);
                    } catch (readErr) {
                        showToast('Gagal membaca file: ' + readErr.message, 'error');
                        inputRestore.value = '';
                    }
                });
            }

        } catch (err) {
            console.warn('[Admin] Quick controls error:', err);
        }
    }

    async function loadDashboardData() {
        try {
            const [kajian, activities, announcements] = await Promise.all([
                FirestoreService.getCollection('kajian', { where: [['isActive', '==', true]] }),
                FirestoreService.getCollection('activities', { where: [['isActive', '==', true]] }),
                FirestoreService.getCollection('announcements', { where: [['isActive', '==', true]] })
            ]);

            setTextContent('dash-kajian-count', kajian.length);
            setTextContent('dash-activity-count', activities.length);
            setTextContent('dash-announcement-count', announcements.length);
            setTextContent('dash-status', FirestoreService.isOnline() ? 'Online' : 'Demo');

            // Setup Quick Controls in Dashboard
            setupQuickControls();
        } catch (e) {
            console.warn('[Admin] Dashboard load error:', e);
        }
    }

    function loadPageData(page) {
        const collectionConfig = COLLECTIONS[page];
        if (collectionConfig) {
            loadCollectionData(page);
        }

        // Special pages
        switch(page) {
            case 'settings': loadSettingsData(); break;
            case 'background': loadBackgroundData(); break;
            case 'prayer': loadPrayerData(); break;
            case 'qris': loadQRISData(); break;
            case 'display': loadDisplaySettings(); break;
            case 'tarawih': loadTarawihData(); break;
        }
    }

    async function loadCollectionData(pageKey) {
        const config = COLLECTIONS[pageKey];
        if (!config) return;

        const collectionName = config.collection || pageKey;
        const listEl = document.getElementById(`${pageKey}-list`);
        if (!listEl) return;

        listEl.innerHTML = '<p class="empty-state">Memuat...</p>';

        try {
            const items = await FirestoreService.getCollection(collectionName, {
                orderBy: 'order'
            });

            if (items.length === 0) {
                listEl.innerHTML = '<p class="empty-state">Belum ada data. Klik tombol tambah untuk memulai.</p>';
                return;
            }

            listEl.innerHTML = items.map(item => {
                const display = config.display(item);
                const badges = (display.badges || []).map(b => 
                    `<span class="data-item-badge ${b.class}">${b.text}</span>`
                ).join('');
                const imgThumb = (display.imageUrl || item.imageUrl) 
                    ? `<img src="${escapeHtml(display.imageUrl || item.imageUrl)}" class="item-thumb-preview" alt="Poster" onerror="this.style.display='none'">` 
                    : '';

                return `
                    <div class="data-item" data-id="${item.id}">
                        <div class="data-item-left">
                            ${imgThumb}
                            <div class="data-item-content">
                                <div class="data-item-title">${escapeHtml(display.title)}</div>
                                <div class="data-item-subtitle">${escapeHtml(display.subtitle)}</div>
                            </div>
                        </div>
                        ${badges}
                        <div class="data-item-actions">
                            <button class="btn-icon" title="Edit" onclick="AdminApp.editItem('${pageKey}', '${item.id}')">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            </button>
                            <button class="btn-icon" title="Hapus" onclick="AdminApp.confirmDelete('${pageKey}', '${item.id}', '${escapeHtml(display.title)}')">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error(`[Admin] Load ${pageKey} error:`, error);
            listEl.innerHTML = '<p class="empty-state">Gagal memuat data.</p>';
        }
    }

    // ── Settings ──

    let _currentLogoBase64 = null;

    async function loadSettingsData() {
        try {
            const settings = await FirestoreService.getDocument('settings', 'mosque');
            if (settings) {
                setInputValue('setting-name', settings.name);
                setInputValue('setting-address', settings.address);
                setInputValue('setting-phone', settings.phone);
                setInputValue('setting-email', settings.email);
                setInputValue('setting-running-text', settings.runningText);
                setInputValue('setting-slide-duration', settings.slideDuration || 8);
                setInputValue('setting-hijri-adj', settings.hijriAdjustment || 0);

                const logo = settings.logoUrl || settings.logo;
                if (logo) {
                    setInputValue('setting-logo-url', logo);
                    const preview = document.getElementById('setting-logo-preview');
                    const placeholder = document.getElementById('logo-upload-placeholder');
                    if (preview) {
                        preview.src = logo;
                        preview.classList.remove('hidden');
                    }
                    if (placeholder) placeholder.classList.add('hidden');
                }
            }
        } catch (e) {
            console.warn('[Admin] Load settings error:', e);
        }
    }

    let _adminClockInterval = null;

    function startAdminLiveClock() {
        if (_adminClockInterval) clearInterval(_adminClockInterval);
        function tick() {
            const tzSelect = document.getElementById('prayer-timezone-select');
            const tz = tzSelect ? tzSelect.value : 'Asia/Jakarta';
            const clockEl = document.getElementById('admin-live-clock');
            const tzEl = document.getElementById('admin-live-tz');
            try {
                const now = new Date();
                const opts = { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
                const timeStr = now.toLocaleTimeString('id-ID', opts).replace(/\./g, ':');
                if (clockEl) clockEl.textContent = timeStr;
                if (tzEl) {
                    tzEl.textContent = tz === 'Asia/Jayapura' ? 'WIT (UTC+9)' : (tz === 'Asia/Makassar' ? 'WITA (UTC+8)' : 'WIB (UTC+7)');
                }
            } catch (e) {}
        }
        tick();
        _adminClockInterval = setInterval(tick, 1000);
    }

    async function loadPrayerData() {
        startAdminLiveClock();

        try {
            // Muat konfigurasi lokasi & zona waktu
            let config = await FirestoreService.getDocument('settings', 'prayerConfig');
            const mosque = await FirestoreService.getDocument('settings', 'mosque');

            const currentTz = (config && config.timezone) || (mosque && mosque.timezone) || 'Asia/Jakarta';
            const currentTzLabel = (config && config.timezoneLabel) || (mosque && mosque.timezoneLabel) || 'WIB (JAKARTA)';

            setInputValue('prayer-timezone-select', currentTz);
            setInputValue('prayer-tz-label', currentTzLabel);

            if (config) {
                setInputValue('prayer-lat', config.latitude !== undefined ? config.latitude : -6.3000);
                setInputValue('prayer-lng', config.longitude !== undefined ? config.longitude : 106.6700);
                setInputValue('prayer-city-input', config.city || 'Tangerang Selatan');
                setInputValue('prayer-method-select', config.method || 20);
            }

            // Muat override manual waktu sholat
            let overrides = await FirestoreService.getDocument('settings', 'prayerOverrides');
            if (!overrides) {
                const local = localStorage.getItem('masjid_prayer_overrides');
                if (local) {
                    try { overrides = JSON.parse(local); } catch (e) {}
                }
            }

            const toggle = document.getElementById('prayer-override-enabled');
            if (toggle) {
                toggle.checked = overrides ? (overrides.enabled === true) : false;
                toggleOverrideFields(toggle.checked);
            }

            const prayerKeys = ['imsak', 'subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
            const defaultTimes = {
                imsak: '04:18', subuh: '04:28', terbit: '05:43', dhuha: '06:05',
                dzuhur: '11:49', ashar: '15:05', maghrib: '17:51', isya: '19:01'
            };

            prayerKeys.forEach(key => {
                const val = (overrides && overrides.times && overrides.times[key]) ? overrides.times[key] : defaultTimes[key];
                setInputValue(`override-${key}`, val);
            });

            // Muat konfigurasi audio & jeda Iqamah
            if (config && config.audio) {
                const audioToggle = document.getElementById('prayer-audio-enabled');
                if (audioToggle) audioToggle.checked = config.audio.enabled !== false;
                setInputValue('iqamah-wait-duration', config.audio.iqamahMinutes || 10);
            }

        } catch (e) {
            console.warn('[Admin] Load prayer data error:', e);
        }
    }

    async function loadQRISData() {
        try {
            const qris = await FirestoreService.getDocument('qris', 'main');
            if (!qris) {
                const qrisList = await FirestoreService.getCollection('qris', { limit: 1 });
                if (qrisList.length > 0) applyQRISData(qrisList[0]);
            } else {
                applyQRISData(qris);
            }
        } catch (e) {
            console.warn('[Admin] Load QRIS error:', e);
        }
    }

    function applyQRISData(qris) {
        setInputValue('qris-label', qris.label);
        document.getElementById('qris-active').checked = qris.isActive !== false;
        if (qris.imageUrl) {
            const preview = document.getElementById('qris-preview');
            if (preview) {
                preview.src = qris.imageUrl;
                preview.classList.remove('hidden');
            }
        }
    }

    async function loadDisplaySettings() {
        try {
            const config = await FirestoreService.getDocument('displaySlides', 'config');
            if (config) {
                setInputValue('display-bg-url', config.backgroundUrl);
                renderSlideOrder(config.slideOrder);
            } else {
                renderSlideOrder(['kajian', 'announcements', 'activities', 'friday', 'news', 'finance', 'qris']);
            }
        } catch (e) {
            console.warn('[Admin] Load display settings error:', e);
        }
    }

    function renderSlideOrder(order) {
        const labels = {
            kajian: 'Kajian Rutin', announcements: 'Pengumuman DKM', activities: 'Kegiatan & Poster',
            friday: 'Info Jumat', news: 'Berita', finance: 'Laporan Kas', qris: 'Infaq QRIS'
        };

        const container = document.getElementById('slide-order-list');
        if (!container) return;

        container.innerHTML = order.map((key, index) => `
            <div class="slide-order-item" data-key="${key}">
                <span class="drag-handle">☰</span>
                <span>${index + 1}. ${labels[key] || key}</span>
            </div>
        `).join('');
    }

    // ── Forms Setup ──

    function setupForms() {
        // Background settings engine
        setupBackgroundForm();

        // Mosque settings
        const logoInput = document.getElementById('setting-logo-file');
        const logoPreview = document.getElementById('setting-logo-preview');
        const logoPlaceholder = document.getElementById('logo-upload-placeholder');

        if (logoInput) {
            logoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const base64 = await compressImage(file, 400, 400, 0.85);
                        _currentLogoBase64 = base64;
                        if (logoPreview) {
                            logoPreview.src = base64;
                            logoPreview.classList.remove('hidden');
                        }
                        if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
                        showToast('Logo masjid berhasil dipilih.', 'info');
                    } catch (err) {
                        showToast('Gagal memproses file gambar logo.', 'error');
                    }
                }
            });
        }

        setupFormSubmit('form-mosque-settings', async () => {
            const data = {
                name: getInputValue('setting-name'),
                address: getInputValue('setting-address'),
                phone: getInputValue('setting-phone'),
                email: getInputValue('setting-email'),
                runningText: getInputValue('setting-running-text'),
                slideDuration: parseInt(getInputValue('setting-slide-duration')) || 10,
                hijriAdjustment: parseInt(getInputValue('setting-hijri-adj')) || 0
            };

            const logoVal = _currentLogoBase64 || getInputValue('setting-logo-url');
            if (logoVal) {
                data.logoUrl = logoVal;
            }

            if (!data.name) throw new Error('Nama masjid wajib diisi.');
            await FirestoreService.setDocument('settings', 'mosque', data);

            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'mosque' } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
            showToast('Pengaturan identitas masjid berhasil disimpan.', 'success');
        });

        // Timezone settings form
        setupFormSubmit('form-timezone-settings', async () => {
            const tz = getInputValue('prayer-timezone-select') || 'Asia/Jakarta';
            const label = getInputValue('prayer-tz-label') || (tz === 'Asia/Jayapura' ? 'WIT (JAYAPURA)' : (tz === 'Asia/Makassar' ? 'WITA (MAKASSAR)' : 'WIB (JAKARTA)'));

            await FirestoreService.setDocument('settings', 'mosque', { timezone: tz, timezoneLabel: label });
            await FirestoreService.setDocument('settings', 'prayerConfig', { timezone: tz, timezoneLabel: label });

            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'timezone' } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
            showToast(`Zona waktu berhasil disetel ke ${label}`, 'success');
        });

        // Quick City Select
        const quickCity = document.getElementById('quick-city-select');
        if (quickCity) {
            quickCity.addEventListener('change', () => {
                const val = quickCity.value;
                if (!val) return;
                const parts = val.split(',');
                if (parts.length >= 5) {
                    setInputValue('prayer-lat', parts[0]);
                    setInputValue('prayer-lng', parts[1]);
                    setInputValue('prayer-city-input', parts[2]);
                    setInputValue('prayer-timezone-select', parts[3]);
                    setInputValue('prayer-tz-label', parts[4]);
                    showToast(`Kota ${parts[2]} terpilih. Klik 'Simpan' untuk menerapkan.`, 'info');
                }
            });
        }

        // Prayer config
        setupFormSubmit('form-prayer-config', async () => {
            const tz = getInputValue('prayer-timezone-select') || 'Asia/Jakarta';
            const label = getInputValue('prayer-tz-label') || 'WIB (JAKARTA)';
            const data = {
                latitude: parseFloat(getInputValue('prayer-lat')),
                longitude: parseFloat(getInputValue('prayer-lng')),
                city: getInputValue('prayer-city-input'),
                method: parseInt(getInputValue('prayer-method-select'), 10) || 20,
                timezone: tz,
                timezoneLabel: label
            };

            await FirestoreService.setDocument('settings', 'prayerConfig', data);
            await FirestoreService.setDocument('settings', 'mosque', { timezone: tz, timezoneLabel: label });

            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'prayer' } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
            showToast('Konfigurasi lokasi & jadwal sholat otomatis berhasil disimpan.', 'success');
        });

        // Prayer override
        setupFormSubmit('form-prayer-override', async () => {
            const enabled = document.getElementById('prayer-override-enabled').checked;
            const prayerKeys = ['imsak', 'subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
            const times = {};
            prayerKeys.forEach(key => {
                times[key] = getInputValue(`override-${key}`) || '';
            });

            const overrideData = { enabled, times, updatedAt: new Date().toISOString() };

            await FirestoreService.setDocument('settings', 'prayerOverrides', overrideData);
            localStorage.setItem('masjid_prayer_overrides', JSON.stringify(overrideData));

            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'prayer' } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
            showToast(enabled ? 'Waktu sholat manual berhasil diterapkan ke Display TV!' : 'Override dinonaktifkan. Mengikuti jadwal otomatis.', 'success');
        });

        // Prayer override toggle
        const overrideToggle = document.getElementById('prayer-override-enabled');
        if (overrideToggle) {
            overrideToggle.addEventListener('change', () => {
                toggleOverrideFields(overrideToggle.checked);
            });
        }

        // Prayer audio & iqamah
        setupFormSubmit('form-prayer-audio', async () => {
            const enabled = document.getElementById('prayer-audio-enabled') ? document.getElementById('prayer-audio-enabled').checked : true;
            const iqamahMinutes = parseInt(getInputValue('iqamah-wait-duration'), 10) || 10;

            const audioData = {
                enabled,
                iqamahMinutes
            };

            await FirestoreService.setDocument('settings', 'prayerConfig', { audio: audioData });
            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'audio' } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
            showToast('Pengaturan pengingat suara & jeda Iqamah berhasil disimpan.', 'success');
        });

        // Test audio chime button
        const btnTestChime = document.getElementById('btn-test-chime');
        if (btnTestChime) {
            btnTestChime.addEventListener('click', () => {
                playAdminChime();
                showToast('Memutar bunyi lonceng pengingat sholat...', 'info');
            });
        }

        // QRIS
        setupFormSubmit('form-qris', async () => {
            const data = {
                label: getInputValue('qris-label') || 'QRIS Masjid Teraskota',
                isActive: document.getElementById('qris-active').checked,
                imageUrl: '' // Will be set if uploaded
            };

            // Handle file upload
            const fileInput = document.getElementById('qris-file');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                
                // Validate
                if (file.size > 2 * 1024 * 1024) {
                    throw new Error('Ukuran file maksimal 2MB.');
                }
                if (!file.type.startsWith('image/')) {
                    throw new Error('File harus berupa gambar.');
                }

                try {
                    const url = await FirestoreService.uploadFile(`qris/main.${file.name.split('.').pop()}`, file);
                    data.imageUrl = url;
                } catch (uploadErr) {
                    console.warn('[Admin] QRIS upload failed:', uploadErr);
                    showToast('Upload gambar gagal. Data tetap disimpan tanpa gambar.', 'warning');
                }
            } else {
                // Keep existing image URL
                const preview = document.getElementById('qris-preview');
                if (preview && preview.src && !preview.classList.contains('hidden')) {
                    data.imageUrl = preview.src;
                }
            }

            await FirestoreService.setDocument('qris', 'main', data);
            showToast('QRIS tersimpan.', 'success');
        });

        // QRIS file preview
        const qrisFile = document.getElementById('qris-file');
        if (qrisFile) {
            qrisFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const preview = document.getElementById('qris-preview');
                        if (preview) {
                            preview.src = ev.target.result;
                            preview.classList.remove('hidden');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Display settings
        setupFormSubmit('form-display-settings', async () => {
            const orderItems = document.querySelectorAll('#slide-order-list .slide-order-item');
            const slideOrder = Array.from(orderItems).map(item => item.getAttribute('data-key'));

            await FirestoreService.setDocument('displaySlides', 'config', {
                slideOrder,
                backgroundUrl: getInputValue('display-bg-url') || '',
                transitionType: 'fade',
                defaultDuration: 8
            });
            showToast('Pengaturan display tersimpan.', 'success');
        });
    }

    function playAdminChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') ctx.resume();

            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.2);

                gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + idx * 0.2 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.2 + 2.0);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + idx * 0.2);
                osc.stop(ctx.currentTime + idx * 0.2 + 2.1);
            });
        } catch (e) {
            console.warn('[Admin] Test chime error:', e);
        }
    }

    // ── Background Settings Engine ──

    let _currentBgFileBase64 = null;

    async function loadBackgroundData() {
        try {
            let bg = await FirestoreService.getDocument('settings', 'background');
            if (!bg) {
                const stored = localStorage.getItem('masjid_bg_settings');
                if (stored) {
                    try { bg = JSON.parse(stored); } catch (e) {}
                }
            }
            if (!bg) {
                bg = { type: 'default', url: '', opacity: 0.65 };
            }

            // Set radio
            const radios = document.querySelectorAll('input[name="bg-type"]');
            radios.forEach(r => {
                r.checked = (r.value === (bg.type || 'default'));
            });

            // Set inputs
            setInputValue('bg-url-input', bg.url || '');
            const opacityPercent = Math.round((bg.opacity !== undefined ? bg.opacity : 0.65) * 100);
            const slider = document.getElementById('bg-opacity-slider');
            if (slider) slider.value = opacityPercent;
            const opacityValEl = document.getElementById('bg-opacity-val');
            // Set fit mode radio
            if (bg.fitMode) {
                const fitRadio = document.querySelector(`input[name="bg-fit-mode"][value="${bg.fitMode}"]`);
                if (fitRadio) fitRadio.checked = true;
            }

            // Update live preview mockup
            updateBackgroundMockup(bg.type || 'default', bg.url || '', (bg.opacity !== undefined ? bg.opacity : 0.65));
        } catch (err) {
            console.warn('[Admin] Load background settings error:', err);
        }
    }

    function updateBackgroundMockup(type, url, opacity) {
        const previewVideo = document.getElementById('preview-box-video');
        const previewImage = document.getElementById('preview-box-image');
        const previewOverlay = document.getElementById('preview-box-overlay');

        if (previewOverlay) {
            previewOverlay.style.opacity = opacity;
        }

        const isVideo = type === 'video' || (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.startsWith('data:video/')));
        const isImage = type === 'image' || (url && (url.startsWith('http') || url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url)));
        const isGradient = type === 'gradient';

        if (isVideo && previewVideo) {
            if (previewVideo.src !== url) {
                previewVideo.src = url;
                previewVideo.load();
            }
            previewVideo.classList.remove('hidden');
            previewVideo.play().catch(() => {});
            if (previewImage) previewImage.style.backgroundImage = 'none';
        } else if (isImage && previewImage) {
            if (previewVideo) {
                previewVideo.pause();
                previewVideo.classList.add('hidden');
            }
            previewImage.style.backgroundImage = `url("${url}")`;
            previewImage.style.background = `url("${url}") center/cover no-repeat`;
        } else if (isGradient && previewImage) {
            if (previewVideo) {
                previewVideo.pause();
                previewVideo.classList.add('hidden');
            }
            previewImage.style.background = url || 'radial-gradient(circle at 50% 20%, #1a324b 0%, #0b131e 75%, #050a10 100%)';
        } else {
            if (previewVideo) {
                previewVideo.pause();
                previewVideo.classList.add('hidden');
            }
            if (previewImage) {
                previewImage.style.backgroundImage = 'none';
                previewImage.style.background = 'radial-gradient(circle at 50% 20%, #132235 0%, #0b131e 70%, #060b11 100%)';
            }
        }
    }

    function setupBackgroundForm() {
        const form = document.getElementById('form-background-settings');
        const fileInput = document.getElementById('bg-file-input');
        const fileInfo = document.getElementById('bg-file-info');
        const urlInput = document.getElementById('bg-url-input');
        const opacitySlider = document.getElementById('bg-opacity-slider');
        const opacityVal = document.getElementById('bg-opacity-val');
        const resetBtn = document.getElementById('btn-reset-bg');

        // 1. Radio changes
        document.querySelectorAll('input[name="bg-type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const selectedType = radio.value;
                const url = _currentBgFileBase64 || (urlInput && urlInput.value ? urlInput.value.trim() : '');
                const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 0.65;
                updateBackgroundMockup(selectedType, url, opacity);
            });
        });

        // 2. File upload change (Supports all image and video formats)
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const isVideo = file.type.startsWith('video/');
                const isImage = file.type.startsWith('image/');

                if (!isVideo && !isImage) {
                    showToast('Format file tidak didukung. Harap pilih gambar atau video MP4/WebM.', 'warning');
                    return;
                }

                // Show file info badge
                if (fileInfo) {
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                    fileInfo.textContent = `✓ Terpilih: ${file.name} (${sizeMB} MB)`;
                    fileInfo.classList.remove('hidden');
                }

                // Automatically switch radio to video or image
                const targetRadio = document.querySelector(`input[name="bg-type"][value="${isVideo ? 'video' : 'image'}"]`);
                if (targetRadio) targetRadio.checked = true;

                // Read file via FileReader as DataURL
                const reader = new FileReader();
                reader.onload = (event) => {
                    _currentBgFileBase64 = event.target.result;
                    if (urlInput) urlInput.value = ''; // clear url when file is uploaded
                    const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 0.65;
                    updateBackgroundMockup(isVideo ? 'video' : 'image', _currentBgFileBase64, opacity);
                };
                reader.readAsDataURL(file);
            });
        }

        // 3. URL input change
        if (urlInput) {
            urlInput.addEventListener('input', () => {
                _currentBgFileBase64 = null; // reset file when url is typed
                if (fileInfo) fileInfo.classList.add('hidden');
                const selectedRadio = document.querySelector('input[name="bg-type"]:checked');
                let type = selectedRadio ? selectedRadio.value : 'image';
                const url = urlInput && urlInput.value ? urlInput.value.trim() : '';

                // Auto detect video from url
                if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                    const videoRadio = document.querySelector('input[name="bg-type"][value="video"]');
                    if (videoRadio) videoRadio.checked = true;
                    type = 'video';
                }

                const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 0.65;
                updateBackgroundMockup(type, url, opacity);
            });
        }

        // 4. Opacity slider input
        if (opacitySlider) {
            opacitySlider.addEventListener('input', () => {
                if (opacityVal) opacityVal.textContent = `${opacitySlider.value}%`;
                const selectedRadio = document.querySelector('input[name="bg-type"]:checked');
                const type = selectedRadio ? selectedRadio.value : 'default';
                const url = _currentBgFileBase64 || (urlInput && urlInput.value ? urlInput.value.trim() : '');
                const opacity = parseFloat(opacitySlider.value) / 100;
                updateBackgroundMockup(type, url, opacity);
            });
        }

        // 5. Presets click
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.getAttribute('data-type');
                const url = btn.getAttribute('data-url');
                const opacity = parseFloat(btn.getAttribute('data-opacity')) || 0.65;

                // Select radio
                const radio = document.querySelector(`input[name="bg-type"][value="${type}"]`);
                if (radio) radio.checked = true;

                // Set url & opacity
                if (urlInput) urlInput.value = url;
                _currentBgFileBase64 = null;
                if (fileInfo) fileInfo.classList.add('hidden');

                if (opacitySlider) opacitySlider.value = Math.round(opacity * 100);
                if (opacityVal) opacityVal.textContent = `${Math.round(opacity * 100)}%`;

                updateBackgroundMockup(type, url, opacity);
            });
        });

        // 6. Form Submit (Save Background)
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSave = document.getElementById('btn-save-bg');
                setButtonLoading(btnSave, true);

                try {
                    const selectedRadio = document.querySelector('input[name="bg-type"]:checked');
                    const type = selectedRadio ? selectedRadio.value : 'default';
                    let url = _currentBgFileBase64 || (urlInput && urlInput.value ? urlInput.value.trim() : '');
                    const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 0.65;

                    const fitModeRadio = document.querySelector('input[name="bg-fit-mode"]:checked');
                    const fitMode = fitModeRadio ? fitModeRadio.value : 'contain';

                    const bgData = {
                        type,
                        url,
                        opacity,
                        fitMode,
                        updatedAt: new Date().toISOString()
                    };

                    // Save to Firestore
                    await FirestoreService.setDocument('settings', 'background', bgData);

                    // Also save to localStorage for instant local / demo cross-tab sync
                    localStorage.setItem('masjid_bg_settings', JSON.stringify(bgData));

                    // Trigger storage event for other windows/tabs
                    try {
                        window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: 'background' } }));
                        window.dispatchEvent(new Event('storage'));
                    } catch (e) {}

                    // If preview iframe exists in preview tab, notify it
                    const previewIframe = document.getElementById('preview-iframe');
                    if (previewIframe && previewIframe.contentWindow && previewIframe.contentWindow.DisplayApp) {
                        previewIframe.contentWindow.DisplayApp.applyBackgroundSettings(bgData);
                    }

                    showToast('Background Display TV berhasil diperbarui dan diterapkan!', 'success');
                } catch (err) {
                    console.error('[Admin] Save background error:', err);
                    showToast('Gagal menyimpan background: ' + err.message, 'error');
                } finally {
                    setButtonLoading(btnSave, false);
                }
            });
        }

        // 7. Reset Background Button
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const defaultBg = { type: 'default', url: '', opacity: 0.65, fitMode: 'contain' };
                await FirestoreService.setDocument('settings', 'background', defaultBg);
                localStorage.setItem('masjid_bg_settings', JSON.stringify(defaultBg));
                _currentBgFileBase64 = null;
                if (fileInfo) fileInfo.classList.add('hidden');
                loadBackgroundData();
                showToast('Background dikembalikan ke default.', 'info');
            });
        }
    }

    function toggleOverrideFields(enabled) {
        const fields = document.getElementById('prayer-override-fields');
        if (fields) {
            fields.classList.toggle('disabled', !enabled);
        }
    }

    // ── Image Helper Utilities (Super Ringan & Cepat) ──

    function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.75) {
        return new Promise((resolve, reject) => {
            if (!file.type || !file.type.startsWith('image/')) {
                reject(new Error('File harus berupa gambar (JPG, PNG, WebP).'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        if (width / height > maxWidth / maxHeight) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Kompresi ke JPEG ringan berkualitas tinggi untuk tampilan TV
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = () => reject(new Error('Gagal memuat file gambar untuk kompresi.'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
            reader.readAsDataURL(file);
        });
    }

    function dataURLtoBlob(dataUrl) {
        try {
            const parts = dataUrl.split(';base64,');
            const contentType = parts[0].split(':')[1];
            const raw = window.atob(parts[1]);
            const uInt8Array = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
            return new Blob([uInt8Array], { type: contentType });
        } catch (e) {
            return null;
        }
    }

    // ── Modal System ──

    function showModal(collectionKey, editData = null) {
        const config = COLLECTIONS[collectionKey];
        if (!config) return;

        _editingCollection = collectionKey;
        _editingId = editData ? editData.id : null;

        const modalTitle = document.getElementById('modal-header-title') || document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const overlay = document.getElementById('modal-overlay');

        if (modalTitle) {
            modalTitle.textContent = editData ? `Edit ${config.title}` : `Tambah ${config.title}`;
        }

        if (modalBody) {
            let formHtml = '<form id="modal-form" class="admin-form">';
            
            config.fields.forEach(field => {
                const value = editData ? (editData[field.key] !== undefined ? editData[field.key] : (field.default || '')) : (field.default || '');

                formHtml += '<div class="form-group">';

                if (field.type === 'toggle') {
                    formHtml += `
                        <label class="toggle-label">
                            <input type="checkbox" id="modal-input-${field.key}" name="${field.key}" ${value ? 'checked' : ''}>
                            <span>${field.label}</span>
                        </label>`;
                } else if (field.type === 'select') {
                    formHtml += `<label for="modal-input-${field.key}">${field.label}</label>`;
                    formHtml += `<select id="modal-input-${field.key}" name="${field.key}" ${field.required ? 'required' : ''}>`;
                    (field.options || []).forEach(opt => {
                        formHtml += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`;
                    });
                    formHtml += '</select>';
                } else if (field.type === 'textarea') {
                    formHtml += `<label for="modal-input-${field.key}">${field.label}</label>`;
                    formHtml += `<textarea id="modal-input-${field.key}" name="${field.key}" rows="3" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">${escapeHtml(String(value))}</textarea>`;
                } else if (field.type === 'image') {
                    formHtml += `
                        <label for="modal-input-${field.key}">${field.label}</label>
                        <div class="file-upload-box" style="background:rgba(255,255,255,0.04); border:1px dashed var(--admin-border); border-radius:12px; padding:12px; margin-bottom:8px;">
                            <input type="file" id="modal-file-${field.key}" accept="image/*" style="margin-bottom:8px; font-size:0.85rem; width:100%;">
                            <input type="text" id="modal-input-${field.key}" name="${field.key}" value="${escapeHtml(String(value))}" placeholder="Atau tempel link URL poster gambar (https://...)">
                            <div style="margin-top:10px; display:flex; align-items:center; gap:12px;">
                                <img id="modal-preview-${field.key}" src="${value || ''}" alt="Preview Poster" style="max-height:100px; max-width:140px; object-fit:contain; border-radius:8px; border:1px solid rgba(255,255,255,0.15); ${value ? '' : 'display:none;'}">
                                <small style="color:var(--admin-text-muted);">Pilih file poster (JPG, PNG, WebP) dari perangkat Anda atau masukkan URL gambar.</small>
                            </div>
                        </div>`;
                } else {
                    formHtml += `<label for="modal-input-${field.key}">${field.label}</label>`;
                    formHtml += `<input type="${field.type || 'text'}" id="modal-input-${field.key}" name="${field.key}" value="${escapeHtml(String(value))}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">`;
                }

                formHtml += '</div>';
            });

            formHtml += `
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="AdminApp.closeModal()">Batal</button>
                    <button type="submit" class="btn btn-primary">${editData ? 'Simpan Perubahan' : 'Tambah Data'}</button>
                </div>
            </form>`;

            modalBody.innerHTML = formHtml;

            // Attach image file listeners
            config.fields.forEach(field => {
                if (field.type === 'image') {
                    const fInput = document.getElementById(`modal-file-${field.key}`);
                    const uInput = document.getElementById(`modal-input-${field.key}`);
                    const prev = document.getElementById(`modal-preview-${field.key}`);
                    if (fInput) {
                        fInput.addEventListener('change', async (ev) => {
                            const file = ev.target.files && ev.target.files[0];
                            if (file) {
                                try {
                                    // Kompresi otomatis untuk efisiensi penyimpanan & render display TV yang super cepat
                                    const compressedDataUrl = await compressImage(file, 1280, 1280, 0.85);
                                    if (uInput) uInput.value = compressedDataUrl;
                                    if (prev) {
                                        prev.src = compressedDataUrl;
                                        prev.style.display = 'block';
                                    }
                                } catch (imgErr) {
                                    console.warn('[Admin] Fallback FileReader:', imgErr);
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        if (uInput) uInput.value = e.target.result;
                                        if (prev) {
                                            prev.src = e.target.result;
                                            prev.style.display = 'block';
                                        }
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }
                        });
                    }
                    if (uInput && prev) {
                        uInput.addEventListener('input', () => {
                            const val = (uInput.value || '').trim();
                            if (val) {
                                prev.src = val;
                                prev.style.display = 'block';
                            } else {
                                prev.style.display = 'none';
                            }
                        });
                    }
                }
            });

            // Setup form submit
            const form = document.getElementById('modal-form');
            if (form) {
                form.addEventListener('submit', handleModalSubmit);
            }
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('hidden');
        _editingId = null;
        _editingCollection = null;
    }

    async function handleModalSubmit(e) {
        e.preventDefault();
        if (_isSubmitting) return;

        const config = COLLECTIONS[_editingCollection];
        if (!config) return;

        _isSubmitting = true;
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳ Menyimpan...</span>';
        }

        try {
            const data = {};
            for (const field of config.fields) {
                const el = form.querySelector(`[name="${field.key}"]`) || 
                           document.getElementById(`modal-input-${field.key}`) || 
                           document.getElementById(`modal-${field.key}`);
                
                if (!el) continue;

                if (field.type === 'toggle') {
                    data[field.key] = el.checked === true;
                } else if (field.type === 'number') {
                    data[field.key] = parseFloat(el.value) || 0;
                } else if (field.type === 'image') {
                    const rawVal = (el.value !== undefined && el.value !== null) ? String(el.value).trim() : '';
                    data[field.key] = rawVal;
                } else {
                    const rawVal = (el.value !== undefined && el.value !== null) ? String(el.value).trim() : '';
                    data[field.key] = rawVal;
                }
            }

            // Validasi field yang wajib diisi
            for (const field of config.fields) {
                if (field.required) {
                    const val = data[field.key];
                    if (val === undefined || val === null || String(val).trim() === '') {
                        throw new Error(`${field.label} wajib diisi.`);
                    }
                }
            }

            const collectionName = config.collection || _editingCollection;

            // Upload ke Firebase Storage (dengan proteksi timeout otomatis)
            for (const field of config.fields) {
                if (field.type === 'image' && data[field.key] && data[field.key].startsWith('data:image/')) {
                    if (FirestoreService.isOnline() && typeof firebase !== 'undefined' && firebase.storage) {
                        try {
                            const blob = dataURLtoBlob(data[field.key]);
                            if (blob) {
                                const filePath = `${collectionName}/${Date.now()}_${field.key}.jpg`;
                                const storageUrl = await FirestoreService.uploadFile(filePath, blob);
                                if (storageUrl) {
                                    data[field.key] = storageUrl;
                                }
                            }
                        } catch (storageErr) {
                            console.warn('[Admin] Menggunakan gambar terkompresi:', storageErr.message);
                        }
                    }
                }
            }

            if (_editingId) {
                await FirestoreService.updateDocument(collectionName, _editingId, data);
                showToast(`${config.title} berhasil diperbarui.`, 'success');
            } else {
                await FirestoreService.addDocument(collectionName, data);
                showToast(`${config.title} berhasil ditambahkan.`, 'success');
            }

            // Simpan key koleksi SEBELUM closeModal menghapusnya
            const savedCollectionKey = _editingCollection || _currentPage;
            closeModal();
            await loadCollectionData(savedCollectionKey);
            await loadDashboardData();

            // Notifikasi cross-tab agar Display TV langsung update
            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { type: savedCollectionKey } }));
            try { window.dispatchEvent(new Event('storage')); } catch(e) {}
        } catch (error) {
            console.error('[Admin] Save error:', error);
            showToast(error.message || 'Gagal menyimpan data.', 'error');
        } finally {
            _isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }

    async function editItem(collectionKey, itemId) {
        const config = COLLECTIONS[collectionKey];
        if (!config) return;

        const collectionName = config.collection || collectionKey;

        try {
            const item = await FirestoreService.getDocument(collectionName, itemId);
            if (item) {
                showModal(collectionKey, item);
            } else {
                showToast('Data tidak ditemukan.', 'error');
            }
        } catch (e) {
            console.error('[Admin] Edit item error:', e);
            showToast('Gagal memuat data.', 'error');
        }
    }

    // ── Delete Confirmation ──

    function confirmDelete(collectionKey, itemId, itemTitle) {
        const config = COLLECTIONS[collectionKey];
        if (!config) return;

        const overlay = document.getElementById('confirm-overlay');
        const message = document.getElementById('confirm-message');
        const btn = document.getElementById('confirm-btn');

        if (message) {
            message.textContent = `Hapus "${itemTitle}" dari ${config.title}? Tindakan ini tidak dapat dibatalkan.`;
        }

        _confirmCallback = async () => {
            try {
                const collectionName = config.collection || collectionKey;
                await FirestoreService.deleteDocument(collectionName, itemId);
                showToast(`${config.title} berhasil dihapus.`, 'success');
                loadCollectionData(collectionKey);
                loadDashboardData();
            } catch (error) {
                console.error('[Admin] Delete error:', error);
                showToast('Gagal menghapus data.', 'error');
            }
            closeConfirm();
        };

        if (btn) {
            btn.onclick = _confirmCallback;
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    function closeConfirm() {
        const overlay = document.getElementById('confirm-overlay');
        if (overlay) overlay.classList.add('hidden');
        _confirmCallback = null;
    }

    // ── Firebase Status ──

    function updateFirebaseStatus() {
        const statusEl = document.getElementById('firebase-status');
        const infoEl = document.getElementById('firebase-info-content');

        if (isFirebaseConfigured()) {
            if (statusEl) statusEl.textContent = 'Firebase terhubung';
            if (infoEl) {
                infoEl.innerHTML = `
                    <p style="color:var(--admin-success);font-weight:600">✓ Firebase dikonfigurasi</p>
                    <p style="margin-top:8px;font-size:0.85rem;color:var(--admin-text-muted)">
                        Project: ${FIREBASE_CONFIG.projectId}<br>
                        Mode: ${FirestoreService.isOnline() ? 'Online' : 'Offline'}
                    </p>
                `;
            }
        } else {
            if (statusEl) statusEl.textContent = 'Mode demo — Firebase belum dikonfigurasi';
            if (infoEl) {
                infoEl.innerHTML = `
                    <p style="color:var(--admin-warning);font-weight:600">⚠ Mode Demo</p>
                    <p style="margin-top:8px;font-size:0.85rem;color:var(--admin-text-muted)">
                        Firebase belum dikonfigurasi. Data yang dimasukkan tidak akan tersimpan secara permanen.<br><br>
                        Untuk menghubungkan Firebase, edit file <code>assets/js/firebase-config.js</code> dengan kredensial dari Firebase Console.<br><br>
                        Lihat dokumentasi di <code>docs/FIREBASE_SETUP.md</code> untuk panduan lengkap.
                    </p>
                `;
            }
        }
    }

    // ── Toast Notifications ──

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove after 4s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── Utilities ──

    function setupFormSubmit(formId, handler) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (_isSubmitting) return;

            _isSubmitting = true;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                await handler();
                showSaveIndicator();
            } catch (error) {
                console.error(`[Admin] Form ${formId} error:`, error);
                showToast(error.message || 'Terjadi kesalahan.', 'error');
            } finally {
                _isSubmitting = false;
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    function showSaveIndicator() {
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
            setTimeout(() => indicator.classList.add('hidden'), 3000);
        }
    }

    function setButtonLoading(btn, loading) {
        if (!btn) return;
        const textEl = btn.querySelector('.btn-text');
        const loaderEl = btn.querySelector('.btn-loader');
        
        if (loading) {
            btn.disabled = true;
            if (textEl) textEl.classList.add('hidden');
            if (loaderEl) loaderEl.classList.remove('hidden');
        } else {
            btn.disabled = false;
            if (textEl) textEl.classList.remove('hidden');
            if (loaderEl) loaderEl.classList.add('hidden');
        }
    }

    function setTextContent(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value !== undefined && value !== null ? value : '';
        }
    }

    function getInputValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el.type === 'checkbox') return el.checked;
        const val = el.value;
        return (val !== undefined && val !== null && typeof val === 'string') ? val.trim() : (val || '');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    }

    function formatCurrency(num) {
        if (!num && num !== 0) return '-';
        return 'Rp ' + Number(num).toLocaleString('id-ID');
    }

    // ── Tarawih 30 Malam Management ──
    async function loadTarawihData() {
        try {
            const data = await FirestoreService.getDocument('settings', 'tarawih');
            const toggleEl = document.getElementById('tarawih-enabled');
            const titleEl = document.getElementById('tarawih-title-input');
            const yearEl = document.getElementById('tarawih-year-input');
            const statusLabel = document.getElementById('tarawih-status-label');
            const tbody = document.getElementById('tarawih-table-body');

            if (data) {
                if (toggleEl) toggleEl.checked = !!data.enabled;
                if (titleEl && data.title) titleEl.value = data.title;
                if (yearEl && data.yearHijri) yearEl.value = data.yearHijri;
                if (statusLabel) statusLabel.textContent = data.enabled ? 'Status di Layar TV: ✅ Aktif' : 'Status di Layar TV: Nonaktif';

                if (tbody && data.nights && data.nights.length > 0) {
                    renderTarawihTable(tbody, data.nights);
                } else if (tbody) {
                    renderTarawihTable(tbody, generateEmptyNights());
                }
            } else {
                if (tbody) renderTarawihTable(tbody, generateEmptyNights());
            }

            // Toggle status label realtime
            if (toggleEl) {
                toggleEl.addEventListener('change', () => {
                    if (statusLabel) statusLabel.textContent = toggleEl.checked ? 'Status di Layar TV: ✅ Aktif' : 'Status di Layar TV: Nonaktif';
                });
            }

            // Autofill button
            const autofillBtn = document.getElementById('btn-tarawih-autofill');
            if (autofillBtn) {
                autofillBtn.onclick = () => {
                    if (tbody) renderTarawihTable(tbody, generateDemoNights());
                    showToast('Data contoh 30 malam telah diisi otomatis.', 'info');
                };
            }

            // Save buttons
            const formEl = document.getElementById('form-tarawih');
            const saveBtnTop = document.getElementById('btn-tarawih-save-top');

            const doSave = async (e) => {
                if (e) e.preventDefault();
                await saveTarawihData();
            };

            if (formEl) formEl.addEventListener('submit', doSave);
            if (saveBtnTop) saveBtnTop.addEventListener('click', doSave);

        } catch (err) {
            console.error('[Admin] Tarawih load error:', err);
            showToast('Gagal memuat data Tarawih: ' + err.message, 'error');
        }
    }

    function generateEmptyNights() {
        return Array.from({ length: 30 }, (_, i) => ({ night: i + 1, imam: '', bilal: '' }));
    }

    function generateDemoNights() {
        const imams = ['Ustadz Ahmad Faiz, Lc.', 'Ustadz Muhammad Ridwan, M.A.', 'Ustadz Hasan Basri, S.Pd.I'];
        const bilals = ['Bpk. Bilal Hasan', 'Sdr. Farhan', 'Sdr. Rasyid'];
        return Array.from({ length: 30 }, (_, i) => ({
            night: i + 1,
            imam: imams[i % imams.length],
            bilal: bilals[i % bilals.length]
        }));
    }

    function renderTarawihTable(tbody, nights) {
        tbody.innerHTML = '';
        nights.forEach((n) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="night-label">Malam ${n.night}</span></td>
                <td><input type="text" data-night="${n.night}" data-field="imam" value="${escapeAttr(n.imam || '')}" placeholder="Nama Imam Malam ${n.night}"></td>
                <td><input type="text" data-night="${n.night}" data-field="bilal" value="${escapeAttr(n.bilal || '')}" placeholder="Nama Bilal Malam ${n.night}"></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function saveTarawihData() {
        try {
            const toggleEl = document.getElementById('tarawih-enabled');
            const titleEl = document.getElementById('tarawih-title-input');
            const yearEl = document.getElementById('tarawih-year-input');
            const tbody = document.getElementById('tarawih-table-body');

            const nights = [];
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const imamInput = row.querySelector('input[data-field="imam"]');
                    const bilalInput = row.querySelector('input[data-field="bilal"]');
                    const nightNum = imamInput ? parseInt(imamInput.getAttribute('data-night'), 10) : 0;
                    nights.push({
                        night: nightNum,
                        imam: imamInput ? imamInput.value.trim() : '',
                        bilal: bilalInput ? bilalInput.value.trim() : ''
                    });
                });
            }

            const payload = {
                enabled: toggleEl ? toggleEl.checked : false,
                title: titleEl ? titleEl.value.trim() : 'Jadwal Imam & Bilal Salat Tarawih',
                yearHijri: yearEl ? yearEl.value.trim() : '',
                nights: nights,
                updatedAt: new Date().toISOString()
            };

            await FirestoreService.saveDocument('settings', 'tarawih', payload);
            showToast('Jadwal Tarawih 30 malam berhasil disimpan! ✅', 'success');

            // Broadcast to display tab
            window.dispatchEvent(new CustomEvent('masjid-data-update', { detail: { key: 'masjid_settings_tarawih' } }));

        } catch (err) {
            console.error('[Admin] Tarawih save error:', err);
            showToast('Gagal menyimpan data Tarawih: ' + err.message, 'error');
        }
    }

    // ── Start ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function loginDemo() {
        _currentUser = { email: 'admin@masjidteraskota.id', uid: 'demo-admin', isDemo: true };
        showAdminPanel();
        showToast('Login berhasil sebagai Admin', 'success');
    }

    // ── Public API ──
    return {
        loginDemo,
        navigateTo,
        showModal,
        closeModal,
        editItem,
        confirmDelete,
        closeConfirm,
        showToast
    };
})();

// Make navigateTo globally accessible for inline onclick
window.navigateTo = AdminApp.navigateTo;
