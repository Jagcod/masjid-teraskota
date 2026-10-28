/**
 * Display TV Controller - Masjid Teraskota
 * 
 * Pixel-Perfect TV Interface Controller matching Islamic Modern Aesthetic
 * Features:
 * - Real-time digital clock (Split Hours:Minutes and Seconds) in Asia/Jakarta (WIB)
 * - Masehi Date & Hijri Calendar with adjustment offset
 * - 7 Horizontal Prayer Times (Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya)
 * - Next Prayer highlight with dynamic countdown (-HH:MM:SS) inside the active card
 * - Split 2-column Slide Showcase (Greeting / Kajian / Agenda + Dua / QRIS card)
 * - Full Background Media Engine: Video (MP4/WebM), Image (JPG/PNG/WebP/GIF/SVG/Base64), Gradient
 * - Ticker / Running Text
 * - Firestore Realtime Sync + LocalStorage Cross-Tab Sync for Admin updates
 */

(function() {
    'use strict';

    // ── Application State ──
    const state = {
        clockInterval: null,
        slideInterval: null,
        prayerInterval: null,
        currentSlideIndex: 0,
        slides: [],
        prayerTimes: null,
        settings: null,
        slideDuration: 8000, // 8 seconds
        isInitialized: false,
        prayerKeys: ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya']
    };

    // ── DOM Element Cache ──
    const DOM = {};

    function cacheDOMReferences() {
        // Clock & Date
        DOM.clockHm = document.getElementById('clock-hours-mins');
        DOM.clockS = document.getElementById('clock-seconds');
        DOM.dateMasehi = document.getElementById('date-masehi');
        DOM.dateHijri = document.getElementById('date-hijri');

        // Mosque Info
        DOM.mosqueName = document.getElementById('mosque-name');
        DOM.mosqueAddress = document.getElementById('address-text');
        DOM.mosqueLogo = document.getElementById('mosque-logo');

        // Slide Showcase
        DOM.slideContainer = document.getElementById('slide-container');
        DOM.slideContent = document.getElementById('slide-content');
        DOM.slideIndicators = document.getElementById('slide-indicators');

        // Footer Ticker
        DOM.runningText = document.getElementById('running-text');

        // Background Layer
        DOM.bgVideo = document.getElementById('bg-video');
        DOM.bgImage = document.getElementById('bg-image');
        DOM.bgOverlay = document.getElementById('bg-overlay');

        // Status & Fallback
        DOM.connectionStatus = document.getElementById('connection-status');
        DOM.connectionText = document.querySelector('.connection-text');
        DOM.fallbackScreen = document.getElementById('fallback-screen');
    }

    // ── Initialization Lifecycle ──
    async function init() {
        console.info('[Display] Initializing TV display system...');
        cacheDOMReferences();

        // 1. Start Clock & Calendar Immediately
        startClock();
        updateDates();

        // 2. Initialize Firestore Database Service
        showConnectionStatus('Menghubungkan ke database...');
        const firestoreReady = await FirestoreService.init();

        if (firestoreReady) {
            showConnectionStatus('Terhubung ke Firestore');
            setTimeout(hideConnectionStatus, 2500);
        } else {
            showConnectionStatus('Mode Standalone / Demo');
            setTimeout(hideConnectionStatus, 3500);
        }

        // 3. Load Settings & Background
        await loadSettings();

        // 4. Load Prayer Times
        await loadPrayerTimes();

        // 5. Load Slide Content
        await loadSlides();

        // 6. Start Prayer Timers & Slide Loop
        startPrayerCountdown();
        startSlideShow();

        // 7. Subscribe to Realtime Data & Cross-tab Events
        subscribeToUpdates();

        // 8. Schedule Daily Refresh at Midnight
        scheduleMidnightRefresh();

        // 9. Page Visibility Handling
        document.addEventListener('visibilitychange', handleVisibilityChange);

        state.isInitialized = true;
        console.info('[Display] TV display system initialized.');
    }

    // ── 1. Digital Clock (Split Hours:Minutes & Seconds) ──
    function startClock() {
        if (state.clockInterval) clearInterval(state.clockInterval);

        function tick() {
            const now = new Date();
            // Formatter for Jakarta timezone (WIB)
            const options = { timeZone: 'Asia/Jakarta', hour12: false };
            const timeStr = now.toLocaleTimeString('id-ID', {
                ...options,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/\./g, ':');

            const parts = timeStr.split(':');
            const hm = `${parts[0] || '00'}:${parts[1] || '00'}`;
            const s = `:${parts[2] || '00'}`;

            if (DOM.clockHm) DOM.clockHm.textContent = hm;
            if (DOM.clockS) DOM.clockS.textContent = s;
        }

        tick();
        state.clockInterval = setInterval(tick, 1000);
    }

    // ── 2. Dates (Masehi & Hijriah) ──
    async function updateDates() {
        if (DOM.dateMasehi) {
            DOM.dateMasehi.textContent = HijriDateService.getMasehiDate();
        }

        if (DOM.dateHijri) {
            try {
                const hijri = await HijriDateService.getHijriDate();
                DOM.dateHijri.textContent = hijri.formatted;
            } catch (err) {
                console.warn('[Display] Hijri date fetch error:', err);
                DOM.dateHijri.textContent = '16 Jumadil Awal 1448 H';
            }
        }
    }

    // ── 3. Settings & Background Engine ──
    async function loadSettings() {
        try {
            // Mosque Identity
            const mosqueSettings = await FirestoreService.getDocument('settings', 'mosque');
            if (mosqueSettings) {
                state.settings = mosqueSettings;
                applyMosqueSettings(mosqueSettings);
            }

            // Background Settings
            const bgSettings = await FirestoreService.getDocument('settings', 'background');
            if (bgSettings) {
                applyBackgroundSettings(bgSettings);
            } else if (mosqueSettings && mosqueSettings.background) {
                applyBackgroundSettings(mosqueSettings.background);
            }

            // Hijri Adjustment
            if (mosqueSettings && mosqueSettings.hijriAdjustment !== undefined) {
                HijriDateService.setAdjustment(mosqueSettings.hijriAdjustment);
                updateDates();
            }

            // Prayer Location Config
            const prayerConfig = await FirestoreService.getDocument('settings', 'prayerConfig');
            if (prayerConfig) {
                PrayerTimesService.setConfig(prayerConfig);
            }
        } catch (error) {
            console.warn('[Display] Settings load error:', error);
        }
    }

    function applyMosqueSettings(settings) {
        if (!settings) return;

        if (settings.name && DOM.mosqueName) {
            DOM.mosqueName.textContent = settings.name;
            document.title = `Display TV - ${settings.name}`;
        }

        if (settings.address && DOM.mosqueAddress) {
            DOM.mosqueAddress.textContent = settings.address;
        }

        if (settings.logoUrl && DOM.mosqueLogo) {
            DOM.mosqueLogo.src = settings.logoUrl;
            DOM.mosqueLogo.style.display = '';
        }

        if (settings.runningText && DOM.runningText) {
            DOM.runningText.textContent = settings.runningText;
        }

        if (settings.slideDuration) {
            state.slideDuration = Math.max(3, parseInt(settings.slideDuration, 10)) * 1000;
        }
    }

    /**
     * Apply Dynamic Background (Supports ANY format: Image, Video, Gradient)
     */
    function applyBackgroundSettings(bg) {
        if (!bg) return;

        const type = bg.type || 'default';
        const url = bg.url || '';
        const opacity = bg.opacity !== undefined ? bg.opacity : 0.65;

        // 1. Set Overlay Darkness Opacity
        document.documentElement.style.setProperty('--bg-overlay-opacity', opacity);

        // 2. Check Media Type
        const isVideo = type === 'video' || (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.startsWith('data:video/')));
        const isImage = type === 'image' || (url && (url.startsWith('http') || url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url)));
        const isGradient = type === 'gradient';

        if (isVideo && DOM.bgVideo) {
            // Play Video
            if (DOM.bgVideo.src !== url) {
                DOM.bgVideo.src = url;
                DOM.bgVideo.load();
            }
            DOM.bgVideo.classList.remove('hidden');
            DOM.bgVideo.play().catch(e => console.info('[Display] Video autoplay notice:', e));
            if (DOM.bgImage) DOM.bgImage.style.backgroundImage = 'none';
        } else if (isImage && DOM.bgImage) {
            // Set Background Image
            if (DOM.bgVideo) {
                DOM.bgVideo.pause();
                DOM.bgVideo.classList.add('hidden');
            }
            DOM.bgImage.style.backgroundImage = `url("${url}")`;
            DOM.bgImage.style.backgroundSize = 'cover';
            DOM.bgImage.style.backgroundPosition = 'center center';
        } else if (isGradient && DOM.bgImage) {
            // Set Custom Gradient
            if (DOM.bgVideo) {
                DOM.bgVideo.pause();
                DOM.bgVideo.classList.add('hidden');
            }
            DOM.bgImage.style.background = url || 'radial-gradient(circle at 50% 20%, #1a324b 0%, #0b131e 75%, #050a10 100%)';
        } else {
            // Reset to Default Modern Islamic Dark Mesh
            if (DOM.bgVideo) {
                DOM.bgVideo.pause();
                DOM.bgVideo.classList.add('hidden');
            }
            if (DOM.bgImage) {
                DOM.bgImage.style.backgroundImage = 'none';
                DOM.bgImage.style.background = 'radial-gradient(circle at 50% 20%, #132235 0%, #0b131e 70%, #060b11 100%)';
            }
        }
    }

    // ── 4. Prayer Times & Active Card Highlighting ──
    async function loadPrayerTimes() {
        try {
            const times = await PrayerTimesService.getTimesWithOverrides();
            if (times) {
                state.prayerTimes = times;
                renderPrayerTimes(times);
            }
        } catch (error) {
            console.warn('[Display] Prayer times fetch error:', error);
        }
    }

    function renderPrayerTimes(times) {
        if (!times) return;

        const nextPrayer = PrayerTimesService.getNextPrayer(times);

        // Update all 7 prayer cards
        state.prayerKeys.forEach(key => {
            // Time text
            const timeEl = document.getElementById(`time-${key}`);
            if (timeEl && times[key]) {
                timeEl.textContent = times[key];
            }

            // Card highlight & countdown
            const cardEl = document.getElementById(`card-${key}`);
            const countdownEl = document.getElementById(`countdown-${key}`);

            if (cardEl) {
                if (nextPrayer && key === nextPrayer.key) {
                    cardEl.classList.add('active');

                    // Format Countdown: -HH:MM:SS
                    if (countdownEl && nextPrayer.countdown) {
                        const { hours, minutes, seconds } = nextPrayer.countdown;
                        const hStr = String(hours).padStart(2, '0');
                        const mStr = String(minutes).padStart(2, '0');
                        const sStr = String(seconds).padStart(2, '0');
                        countdownEl.textContent = `-${hStr}:${mStr}:${sStr}`;
                        countdownEl.classList.remove('hidden');
                    }
                } else {
                    cardEl.classList.remove('active');
                    if (countdownEl) countdownEl.classList.add('hidden');
                }
            }
        });
    }

    function startPrayerCountdown() {
        if (state.prayerInterval) clearInterval(state.prayerInterval);

        function update() {
            if (!state.prayerTimes) return;
            renderPrayerTimes(state.prayerTimes);
        }

        update();
        state.prayerInterval = setInterval(update, 1000);
    }

    // ── 5. Slide Showcase Engine ──
    async function loadSlides() {
        const slides = [];

        try {
            // Slide 1: Welcome & Doa Masuk Masjid (Exact match with user screenshot)
            slides.push(createWelcomeSlide());

            // Slide 2: Jadwal Kajian Rutin
            const kajian = await FirestoreService.getCollection('kajian', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (kajian && kajian.length > 0) {
                slides.push(createKajianSlide(kajian));
            }

            // Slide 3: Kegiatan & Agenda Masjid
            const activities = await FirestoreService.getCollection('activities', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (activities && activities.length > 0) {
                slides.push(createActivitiesSlide(activities));
            }

            // Slide 4: Petugas Salat Jumat
            const friday = await FirestoreService.getCollection('fridaySchedules', {
                where: [['isActive', '==', true]],
                orderBy: 'date',
                orderDir: 'desc',
                limit: 1
            });
            if (friday && friday.length > 0) {
                slides.push(createFridaySlide(friday[0]));
            }

            // Slide 5: Laporan Kas & QRIS Infaq
            const finance = await FirestoreService.getCollection('financeReports', {
                where: [['isActive', '==', true]],
                limit: 1
            });
            const qris = await FirestoreService.getCollection('qris', {
                where: [['isActive', '==', true]],
                limit: 1
            });
            if ((finance && finance.length > 0) || (qris && qris.length > 0)) {
                slides.push(createFinanceQRISSlide(finance ? finance[0] : null, qris ? qris[0] : null));
            }

            // Slide 6: Pengumuman Khusus
            const announcements = await FirestoreService.getCollection('announcements', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (announcements && announcements.length > 0) {
                slides.push(createAnnouncementSlide(announcements[0]));
            }

        } catch (err) {
            console.warn('[Display] Slide load error:', err);
        }

        // Ensure at least welcome slide is present
        if (slides.length === 0) {
            slides.push(createWelcomeSlide());
        }

        state.slides = slides;
        state.currentSlideIndex = 0;
        renderCurrentSlide();
        renderSlideIndicators();
    }

    // ── Slide Builders ──

    // 1. Welcome & Doa Masuk Masjid (Default exact match)
    function createWelcomeSlide() {
        return {
            id: 'welcome',
            html: `
                <div class="slide slide-welcome">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">🕌</span>
                            <span>AHLAN WA SAHLAN • RUMAH ALLAH</span>
                        </div>
                        <div class="arabic-greeting">السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ</div>
                        <h2 class="welcome-heading">Selamat Datang di <span class="text-gold">Masjid Teraskota</span></h2>
                        <p class="welcome-subheading">Pusat Ibadah, Dakwah & Pembinaan Umat • BSD City</p>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">🕌</span>
                                <span>DOA MASUK MASJID</span>
                            </div>
                            <div class="card-arabic">اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ</div>
                            <div class="card-translation">"Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu."</div>
                            <div class="card-ref">(HR. Muslim no. 713 • Sunan Abu Dawud)</div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 2. Kajian Slide
    function createKajianSlide(kajianList) {
        const rows = kajianList.slice(0, 4).map(k => `
            <tr>
                <td style="font-weight:700; color:var(--gold);">${escapeHtml(k.day || '')} ${escapeHtml(k.time || '')}</td>
                <td style="font-weight:700;">${escapeHtml(k.title || '')}</td>
                <td style="color:var(--cyan-text);">${escapeHtml(k.speaker || '')}</td>
            </tr>
        `).join('');

        return {
            id: 'kajian',
            html: `
                <div class="slide slide-kajian">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">📖</span>
                            <span>JADWAL KAJIAN ISLAM RUTIN</span>
                        </div>
                        <h2 class="welcome-heading">Majelis Ilmu & Dakwah</h2>
                        <div class="slide-table-wrap">
                            <table class="slide-table">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>Tema Kajian</th>
                                        <th>Narasumber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">✨</span>
                                <span>KEUTAMAAN MENUNTUT ILMU</span>
                            </div>
                            <div class="card-arabic">مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ</div>
                            <div class="card-translation">"Barangsiapa menempuh jalan untuk mencari ilmu, Allah mudahkan baginya jalan menuju surga."</div>
                            <div class="card-ref">(HR. Muslim no. 2699)</div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 3. Activities Slide
    function createActivitiesSlide(activities) {
        const rows = activities.slice(0, 3).map(a => `
            <div style="margin-bottom:12px; border-left:3px solid var(--gold); padding-left:12px;">
                <div style="color:var(--gold); font-size:0.9rem; font-weight:700;">📅 ${escapeHtml(a.date || '')} ${escapeHtml(a.time || '')}</div>
                <div style="color:#ffffff; font-size:1.15rem; font-weight:700;">${escapeHtml(a.title || '')}</div>
                <div style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(a.description || '')}</div>
            </div>
        `).join('');

        return {
            id: 'activities',
            html: `
                <div class="slide slide-activities">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">📅</span>
                            <span>AGENDA & KEGIATAN MASJID</span>
                        </div>
                        <h2 class="welcome-heading">Kegiatan Terdekat</h2>
                        <div style="margin-top:14px; width:100%;">
                            ${rows}
                        </div>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">🤝</span>
                                <span>PENGINGAT AMAL</span>
                            </div>
                            <div class="card-arabic">وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ</div>
                            <div class="card-translation">"Dan tolong-menolonglah kamu dalam mengerjakan kebajikan dan takwa."</div>
                            <div class="card-ref">(QS. Al-Maidah: 2)</div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 4. Friday Schedule Slide
    function createFridaySlide(item) {
        return {
            id: 'friday',
            html: `
                <div class="slide slide-friday">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">🕌</span>
                            <span>SALAT JUMAT BERJEMAAH</span>
                        </div>
                        <div class="arabic-greeting">يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ</div>
                        <h2 class="welcome-heading">Jadwal Petugas Salat Jumat</h2>
                        <p class="welcome-subheading">Tanggal: ${escapeHtml(item.date || 'Jumat Pekan Ini')}</p>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">🎙️</span>
                                <span>PETUGAS JUMAT</span>
                            </div>
                            <div style="width:100%; text-align:left; padding:0 12px; margin-bottom:12px;">
                                <div style="margin-bottom:8px;">
                                    <span style="color:var(--text-muted); font-size:0.85rem;">Khatib:</span>
                                    <div style="color:var(--gold); font-size:1.25rem; font-weight:800;">${escapeHtml(item.khatib || 'Ustadz Tamu')}</div>
                                </div>
                                <div style="margin-bottom:8px;">
                                    <span style="color:var(--text-muted); font-size:0.85rem;">Imam:</span>
                                    <div style="color:#ffffff; font-size:1.15rem; font-weight:700;">${escapeHtml(item.imam || 'Imam Rawatib')}</div>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.85rem;">Muazin:</span>
                                    <div style="color:var(--cyan-text); font-size:1.1rem; font-weight:700;">${escapeHtml(item.muazin || 'Muazin Masjid')}</div>
                                </div>
                            </div>
                            <div class="card-ref" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:8px; width:100%;">
                                Tema: ${escapeHtml(item.tema || 'Tuntunan Ibadah & Pembinaan Takwa')}
                            </div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 5. Finance & QRIS Slide
    function createFinanceQRISSlide(finance, qris) {
        const saldoText = finance ? `Rp ${(finance.saldo || 0).toLocaleString('id-ID')}` : 'Rp 45.250.000';
        const pemasukanText = finance ? `Rp ${(finance.pemasukan || 0).toLocaleString('id-ID')}` : 'Rp 12.400.000';
        const pengeluaranText = finance ? `Rp ${(finance.pengeluaran || 0).toLocaleString('id-ID')}` : 'Rp 8.150.000';
        const qrisImg = (qris && qris.imageUrl) ? qris.imageUrl : 'assets/images/logo-masjid.svg';

        return {
            id: 'finance-qris',
            html: `
                <div class="slide slide-finance">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">💳</span>
                            <span>LAPORAN KAS & ZISWAF</span>
                        </div>
                        <h2 class="welcome-heading">Transparansi Keuangan</h2>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%; margin-top:10px;">
                            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px;">
                                <div style="color:var(--text-muted); font-size:0.8rem;">Pemasukan Kas</div>
                                <div style="color:var(--emerald-light); font-size:1.2rem; font-weight:800;">${pemasukanText}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px;">
                                <div style="color:var(--text-muted); font-size:0.8rem;">Pengeluaran Kas</div>
                                <div style="color:#f87171; font-size:1.2rem; font-weight:800;">${pengeluaranText}</div>
                            </div>
                        </div>
                        <div style="margin-top:12px; background:rgba(250,204,21,0.1); border:1px solid rgba(250,204,21,0.3); border-radius:12px; padding:12px; width:100%;">
                            <div style="color:var(--gold); font-size:0.85rem; font-weight:700;">SALDO KAS SAAT INI</div>
                            <div style="color:#ffffff; font-size:1.8rem; font-weight:800;">${saldoText}</div>
                        </div>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">📲</span>
                                <span>INFAQ DIGITAL QRIS</span>
                            </div>
                            <div style="background:#ffffff; border-radius:12px; padding:10px; display:inline-block; margin-bottom:10px;">
                                <img src="${qrisImg}" alt="QRIS Infaq" style="width:130px; height:130px; object-fit:contain; display:block;">
                            </div>
                            <div class="card-translation" style="font-size:0.85rem; margin-bottom:4px;">Scan QRIS menggunakan Mobile Banking atau e-Wallet</div>
                            <div class="card-ref">Rekening BSI: 7123-4567-89 a.n. Masjid Teraskota</div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 6. Announcement Slide
    function createAnnouncementSlide(ann) {
        return {
            id: 'announcement',
            html: `
                <div class="slide slide-announcement">
                    <div class="slide-left-col">
                        <div class="welcome-tag">
                            <span class="tag-icon">📢</span>
                            <span>PENGUMUMAN DKM</span>
                        </div>
                        <h2 class="welcome-heading">${escapeHtml(ann.title || 'Warta Masjid')}</h2>
                        <p class="welcome-subheading" style="color:#ffffff; font-weight:500; font-size:1.2rem; margin-top:10px;">
                            ${escapeHtml(ann.content || '')}
                        </p>
                    </div>
                    <div class="slide-right-col">
                        <div class="feature-card">
                            <div class="card-header-badge">
                                <span class="badge-icon">✨</span>
                                <span>ADAB DI DALAM MASJID</span>
                            </div>
                            <div class="card-arabic">خَيْرُ الْبِقَاعِ مَسَاجِدُهَا</div>
                            <div class="card-translation">"Tempat yang paling dicintai Allah di muka bumi adalah masjid-masjidnya."</div>
                            <div class="card-ref">(HR. Muslim no. 671)</div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // ── Slide Controller & Indicators ──
    function renderCurrentSlide() {
        if (!DOM.slideContent || state.slides.length === 0) return;

        const slide = state.slides[state.currentSlideIndex];
        DOM.slideContent.innerHTML = slide.html;

        // Update Dots
        if (DOM.slideIndicators) {
            const dots = DOM.slideIndicators.querySelectorAll('.indicator-dot');
            dots.forEach((dot, idx) => {
                if (idx === state.currentSlideIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
    }

    function renderSlideIndicators() {
        if (!DOM.slideIndicators) return;
        DOM.slideIndicators.innerHTML = '';

        state.slides.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = `indicator-dot ${idx === state.currentSlideIndex ? 'active' : ''}`;
            DOM.slideIndicators.appendChild(dot);
        });
    }

    function startSlideShow() {
        if (state.slideInterval) clearInterval(state.slideInterval);

        state.slideInterval = setInterval(() => {
            if (state.slides.length <= 1) return;
            state.currentSlideIndex = (state.currentSlideIndex + 1) % state.slides.length;
            renderCurrentSlide();
        }, state.slideDuration);
    }

    // ── 6. Realtime Updates & Cross-Tab Sync ──
    function subscribeToUpdates() {
        // 1. Online Firestore listener
        if (FirestoreService.isOnline && FirestoreService.isOnline()) {
            FirestoreService.listenDocument('settings', 'mosque', (data) => {
                if (data) {
                    applyMosqueSettings(data);
                    if (data.background) applyBackgroundSettings(data.background);
                }
            });

            FirestoreService.listenDocument('settings', 'background', (data) => {
                if (data) applyBackgroundSettings(data);
            });

            FirestoreService.listenCollection('kajian', () => loadSlides());
            FirestoreService.listenCollection('activities', () => loadSlides());
            FirestoreService.listenCollection('announcements', () => loadSlides());
            FirestoreService.listenCollection('fridaySchedules', () => loadSlides());
            FirestoreService.listenCollection('financeReports', () => loadSlides());
            FirestoreService.listenCollection('qris', () => loadSlides());
        }

        // 2. Cross-tab LocalStorage sync (Works instantly in demo mode & local server)
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('masjid_')) {
                console.info('[Display] LocalStorage update detected:', e.key);
                loadSettings();
                loadPrayerTimes();
                loadSlides();
            }
        });
    }

    // ── 7. Midnight Refresh & Visibility ──
    function scheduleMidnightRefresh() {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        setTimeout(() => {
            console.info('[Display] Midnight reached. Refreshing prayer times and dates...');
            updateDates();
            loadPrayerTimes();
            scheduleMidnightRefresh();
        }, msUntilMidnight);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            if (state.slideInterval) clearInterval(state.slideInterval);
        } else {
            startClock();
            startPrayerCountdown();
            startSlideShow();
            updateDates();
        }
    }

    // ── Helpers ──
    function showConnectionStatus(msg) {
        if (!DOM.connectionStatus) return;
        if (DOM.connectionText) DOM.connectionText.textContent = msg;
        DOM.connectionStatus.classList.remove('hidden');
    }

    function hideConnectionStatus() {
        if (DOM.connectionStatus) DOM.connectionStatus.classList.add('hidden');
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Expose Global Display Interface for debugging & preview iframe
    window.DisplayApp = {
        init,
        applyBackgroundSettings,
        loadSlides,
        loadSettings,
        loadPrayerTimes
    };

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
