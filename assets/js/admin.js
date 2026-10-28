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
            title: 'Kajian',
            fields: [
                { key: 'title', label: 'Judul Kajian', type: 'text', required: true },
                { key: 'speaker', label: 'Pemateri', type: 'text', required: true },
                { key: 'day', label: 'Hari', type: 'select', options: ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'], required: true },
                { key: 'time', label: 'Waktu', type: 'time', required: true },
                { key: 'location', label: 'Lokasi', type: 'text' },
                { key: 'description', label: 'Deskripsi', type: 'textarea' },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: `${item.day || ''} ${item.time || ''} — ${item.speaker || ''}`,
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
            })
        },
        activities: {
            title: 'Kegiatan',
            fields: [
                { key: 'title', label: 'Nama Kegiatan', type: 'text', required: true },
                { key: 'date', label: 'Tanggal', type: 'date', required: true },
                { key: 'time', label: 'Waktu', type: 'time' },
                { key: 'description', label: 'Deskripsi', type: 'textarea' },
                { key: 'order', label: 'Urutan', type: 'number', default: 1 },
                { key: 'isActive', label: 'Aktif', type: 'toggle', default: true }
            ],
            display: (item) => ({
                title: item.title || '-',
                subtitle: `${formatDateShort(item.date)} ${item.time || ''}`,
                badges: [
                    item.isActive ? { text: 'Aktif', class: 'badge-active' } : { text: 'Nonaktif', class: 'badge-inactive' }
                ]
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

                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

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
                    let msg = 'Gagal login. Periksa email dan password.';
                    if (error.code === 'auth/user-not-found') msg = 'Akun tidak ditemukan.';
                    if (error.code === 'auth/wrong-password') msg = 'Password salah.';
                    if (error.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
                    if (error.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
                    if (error.code === 'auth/network-request-failed') msg = 'Koneksi gagal. Periksa internet.';
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
            if (token.claims.admin === true) return true;

            // Method 2: Check Firestore adminProfiles collection
            if (FirestoreService.isOnline()) {
                const adminDoc = await FirestoreService.getDocument('adminProfiles', user.uid);
                if (adminDoc && adminDoc.isAdmin === true) return true;
            }

            // For initial setup: first user might be admin by default
            // This should be secured later
            return true; // TODO: Remove after first admin setup
        } catch (e) {
            console.warn('[Auth] Admin check error:', e);
            return true; // Allow access if check fails (fallback)
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

    // ── Data Loading ──

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

                return `
                    <div class="data-item" data-id="${item.id}">
                        <div class="data-item-content">
                            <div class="data-item-title">${escapeHtml(display.title)}</div>
                            <div class="data-item-subtitle">${escapeHtml(display.subtitle)}</div>
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
            }
        } catch (e) {
            console.warn('[Admin] Load settings error:', e);
        }
    }

    async function loadPrayerData() {
        try {
            const config = await FirestoreService.getDocument('settings', 'prayerConfig');
            if (config) {
                setInputValue('prayer-lat', config.latitude);
                setInputValue('prayer-lng', config.longitude);
                setInputValue('prayer-city-input', config.city);
                setInputValue('prayer-method-select', config.method);
            }

            const overrides = await FirestoreService.getDocument('settings', 'prayerOverrides');
            if (overrides) {
                document.getElementById('prayer-override-enabled').checked = overrides.enabled || false;
                toggleOverrideFields(overrides.enabled || false);
                if (overrides.times) {
                    const prayerKeys = ['imsak', 'subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
                    prayerKeys.forEach(key => {
                        setInputValue(`override-${key}`, overrides.times[key] || '');
                    });
                }
            }
        } catch (e) {
            console.warn('[Admin] Load prayer data error:', e);
        }
    }

    async function loadQRISData() {
        try {
            const qris = await FirestoreService.getDocument('qris', 'main');
            if (!qris) {
                // Try getting from collection
                const qrisList = await FirestoreService.getCollection('qris', { limit: 1 });
                if (qrisList.length > 0) {
                    applyQRISData(qrisList[0]);
                }
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
            kajian: 'Kajian', announcements: 'Pengumuman', activities: 'Kegiatan',
            friday: 'Info Jumat', news: 'Berita', finance: 'Keuangan', qris: 'QRIS'
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
        setupFormSubmit('form-mosque-settings', async () => {
            const data = {
                name: getInputValue('setting-name'),
                address: getInputValue('setting-address'),
                phone: getInputValue('setting-phone'),
                email: getInputValue('setting-email'),
                runningText: getInputValue('setting-running-text'),
                slideDuration: parseInt(getInputValue('setting-slide-duration')) || 8,
                hijriAdjustment: parseInt(getInputValue('setting-hijri-adj')) || 0
            };

            if (!data.name) throw new Error('Nama masjid wajib diisi.');
            await FirestoreService.setDocument('settings', 'mosque', data);
            showToast('Pengaturan masjid tersimpan.', 'success');
        });

        // Prayer config
        setupFormSubmit('form-prayer-config', async () => {
            const data = {
                latitude: parseFloat(getInputValue('prayer-lat')),
                longitude: parseFloat(getInputValue('prayer-lng')),
                city: getInputValue('prayer-city-input'),
                method: parseInt(getInputValue('prayer-method-select'))
            };

            await FirestoreService.setDocument('settings', 'prayerConfig', data);
            showToast('Konfigurasi jadwal sholat tersimpan.', 'success');
        });

        // Prayer override
        setupFormSubmit('form-prayer-override', async () => {
            const enabled = document.getElementById('prayer-override-enabled').checked;
            const prayerKeys = ['imsak', 'subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
            const times = {};
            prayerKeys.forEach(key => {
                times[key] = getInputValue(`override-${key}`) || '';
            });

            await FirestoreService.setDocument('settings', 'prayerOverrides', { enabled, times });
            showToast('Override jadwal sholat tersimpan.', 'success');
        });

        // Prayer override toggle
        const overrideToggle = document.getElementById('prayer-override-enabled');
        if (overrideToggle) {
            overrideToggle.addEventListener('change', () => {
                toggleOverrideFields(overrideToggle.checked);
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
            if (opacityValEl) opacityValEl.textContent = `${opacityPercent}%`;

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
                const url = _currentBgFileBase64 || (urlInput ? urlInput.value.trim() : '');
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
                const url = urlInput.value.trim();

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
                const url = _currentBgFileBase64 || (urlInput ? urlInput.value.trim() : '');
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
                    let url = _currentBgFileBase64 || (urlInput ? urlInput.value.trim() : '');
                    const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 0.65;

                    const bgData = {
                        type,
                        url,
                        opacity,
                        updatedAt: new Date().toISOString()
                    };

                    // Save to Firestore
                    await FirestoreService.setDocument('settings', 'background', bgData);

                    // Also save to localStorage for instant local / demo cross-tab sync
                    localStorage.setItem('masjid_bg_settings', JSON.stringify(bgData));

                    // Trigger storage event for other windows/tabs
                    try {
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
                const defaultBg = { type: 'default', url: '', opacity: 0.65 };
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

    // ── Modal System ──

    function showModal(collectionKey, editData = null) {
        const config = COLLECTIONS[collectionKey];
        if (!config) return;

        _editingCollection = collectionKey;
        _editingId = editData ? editData.id : null;

        const modalTitle = document.getElementById('modal-title');
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
                            <input type="checkbox" id="modal-${field.key}" ${value ? 'checked' : ''}>
                            <span>${field.label}</span>
                        </label>`;
                } else if (field.type === 'select') {
                    formHtml += `<label for="modal-${field.key}">${field.label}</label>`;
                    formHtml += `<select id="modal-${field.key}" ${field.required ? 'required' : ''}>`;
                    (field.options || []).forEach(opt => {
                        formHtml += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`;
                    });
                    formHtml += '</select>';
                } else if (field.type === 'textarea') {
                    formHtml += `<label for="modal-${field.key}">${field.label}</label>`;
                    formHtml += `<textarea id="modal-${field.key}" rows="3" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">${escapeHtml(String(value))}</textarea>`;
                } else {
                    formHtml += `<label for="modal-${field.key}">${field.label}</label>`;
                    formHtml += `<input type="${field.type || 'text'}" id="modal-${field.key}" value="${escapeHtml(String(value))}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">`;
                }

                formHtml += '</div>';
            });

            formHtml += `
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="AdminApp.closeModal()">Batal</button>
                    <button type="submit" class="btn btn-primary">${editData ? 'Simpan Perubahan' : 'Tambah'}</button>
                </div>
            </form>`;

            modalBody.innerHTML = formHtml;

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
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const data = {};
            config.fields.forEach(field => {
                const el = document.getElementById(`modal-${field.key}`);
                if (!el) return;

                if (field.type === 'toggle') {
                    data[field.key] = el.checked;
                } else if (field.type === 'number') {
                    data[field.key] = parseFloat(el.value) || 0;
                } else {
                    data[field.key] = el.value.trim();
                }
            });

            // Validate required fields
            for (const field of config.fields) {
                if (field.required && !data[field.key]) {
                    throw new Error(`${field.label} wajib diisi.`);
                }
            }

            const collectionName = config.collection || _editingCollection;

            if (_editingId) {
                await FirestoreService.updateDocument(collectionName, _editingId, data);
                showToast(`${config.title} berhasil diperbarui.`, 'success');
            } else {
                await FirestoreService.addDocument(collectionName, data);
                showToast(`${config.title} berhasil ditambahkan.`, 'success');
            }

            closeModal();
            loadCollectionData(_editingCollection || _currentPage);
            loadDashboardData();
        } catch (error) {
            console.error('[Admin] Save error:', error);
            showToast(error.message || 'Gagal menyimpan data.', 'error');
        } finally {
            _isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
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
        return el.value.trim();
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

    // ── Start ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Public API ──
    return {
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
