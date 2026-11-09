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

(function () {
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
        slideDuration: 15000, // 15 detik (tenang & nyaman dibaca)
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
    function loadInstantLocalData() {
        // 1. Instant background from localStorage
        try {
            const savedBg = localStorage.getItem('masjid_bg_settings');
            if (savedBg) {
                applyBackgroundSettings(JSON.parse(savedBg));
            } else {
                const demoStore = localStorage.getItem('masjid_demo_store');
                if (demoStore) {
                    const parsed = JSON.parse(demoStore);
                    if (parsed && parsed.settings && parsed.settings.background) {
                        applyBackgroundSettings(parsed.settings.background);
                    }
                }
            }
        } catch(e) {}

        // 2. Instant Mosque settings from demoStore or localStorage
        try {
            const demoStore = localStorage.getItem('masjid_demo_store');
            if (demoStore) {
                const parsed = JSON.parse(demoStore);
                if (parsed && parsed.settings) {
                    if (parsed.settings.mosque) {
                        state.settings = parsed.settings.mosque;
                        applyMosqueSettings(parsed.settings.mosque);
                    }
                    if (parsed.settings.prayerConfig) {
                        PrayerTimesService.setConfig(parsed.settings.prayerConfig);
                        if (parsed.settings.prayerConfig.timezoneLabel) {
                            state.settings = { ...(state.settings || {}), timezoneLabel: parsed.settings.prayerConfig.timezoneLabel };
                        }
                    }
                }
            }
        } catch(e) {}

        // 3. Instant Timezone label
        updateTimezoneLabel();
    }

    async function init() {
        console.info('[Display] Initializing TV display system...');
        cacheDOMReferences();

        // 1. Start Clock & Calendar Immediately
        startClock();
        updateDates();

        // 2. Load Local Data INSTANTLY (0 ms latency, no waiting for database)
        loadInstantLocalData();

        // 3. Load Prayer Times Immediately (from cache/defaults)
        loadPrayerTimes();

        // 4. Load Slide Content Immediately (from cache/defaults)
        loadSlides();

        // 5. Start Timers
        startPrayerCountdown();
        startSlideShow();

        // 6. Cross-tab & Realtime Sync
        subscribeToUpdates();

        // 7. Hijri background update listener
        window.addEventListener('masjid-hijri-updated', (evt) => {
            if (evt.detail && evt.detail.formatted && DOM.dateHijri) {
                DOM.dateHijri.textContent = evt.detail.formatted;
            }
        });

        // 8. Refresh dates every 60 seconds
        setInterval(() => { updateDates(); }, 60000);

        // 9. Schedule Daily Refresh at Midnight
        scheduleMidnightRefresh();

        // 10. Page Visibility Handling
        document.addEventListener('visibilitychange', handleVisibilityChange);

        state.isInitialized = true;
        console.info('[Display] TV display system initialized instantly.');

        // 11. Connect to Firestore in background (Non-blocking)
        FirestoreService.init().then((firestoreReady) => {
            if (firestoreReady) {
                console.info('[Display] Firestore ready, syncing latest cloud data...');
                loadSettings();
                loadPrayerTimes();
                loadSlides();
            }
        }).catch(err => console.warn('[Display] Firestore init notice:', err));
    }

    // ── 1. Digital Clock (Split Hours:Minutes & Seconds) ──
    function startClock() {
        if (state.clockInterval) clearInterval(state.clockInterval);

        function tick() {
            const now = new Date();
            const tz = (state.settings && state.settings.timezone) || 'Asia/Jakarta';
            // Formatter for configured timezone
            const options = { timeZone: tz, hour12: false };
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
        const tz = (state.settings && state.settings.timezone) || 'Asia/Jakarta';

        if (DOM.dateMasehi) {
            // Use timezone-aware date
            try {
                const now = new Date();
                const formatter = new Intl.DateTimeFormat('id-ID', {
                    timeZone: tz,
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                DOM.dateMasehi.textContent = formatter.format(now);
            } catch (e) {
                DOM.dateMasehi.textContent = HijriDateService.getMasehiDate();
            }
        }

        if (DOM.dateHijri) {
            try {
                const hijri = await HijriDateService.getHijriDate();
                DOM.dateHijri.textContent = hijri.formatted;
            } catch (err) {
                console.warn('[Display] Hijri date fetch error:', err);
                DOM.dateHijri.textContent = '';
            }
        }

        // Update timezone label
        updateTimezoneLabel();
    }

    function updateTimezoneLabel() {
        const storedTz = localStorage.getItem('masjid_tz_label');
        const tzLabel = (state.settings && state.settings.timezoneLabel) || storedTz || 'WIB (JAKARTA)';
        const tzEl = document.querySelector('.clock-tz span');
        if (tzEl) {
            tzEl.textContent = tzLabel;
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
                if (prayerConfig.timezoneLabel || prayerConfig.timezone) {
                    state.settings = { ...(state.settings || {}), timezone: prayerConfig.timezone || state.settings?.timezone, timezoneLabel: prayerConfig.timezoneLabel || state.settings?.timezoneLabel };
                    updateTimezoneLabel();
                }
            }
        } catch (error) {
            console.warn('[Display] Settings load error:', error);
        }
    }

    function applyMosqueSettings(settings) {
        if (!settings) return;

        // Save settings to state for timezone usage
        state.settings = { ...state.settings, ...settings };

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
            const raw = settings.runningText.trim();
            const items = raw.split(/[\n|•]+/).map(s => s.trim()).filter(Boolean);
            if (items.length > 1) {
                DOM.runningText.innerHTML = items.map(t => escapeHtml(t)).join(' <span style="color:var(--gold); margin:0 1.2vw; font-size:1.15em;">✦</span> ');
            } else {
                DOM.runningText.textContent = raw;
            }
        }

        // Timezone update — refresh clock and label
        if (settings.timezone || settings.timezoneLabel) {
            startClock(); // Restart clock with new timezone
            updateTimezoneLabel();
            updateDates();
        }

        // Sholat Mode Check
        if (settings.sholatMode !== undefined) {
            toggleSholatMode(!!settings.sholatMode);
        }

        if (settings.slideDuration) {
            state.slideDuration = Math.max(10, parseInt(settings.slideDuration, 10) || 15) * 1000;
            startSlideShow();
        }
    }

    function toggleSholatMode(active) {
        let el = document.getElementById('sholat-mode-screen');
        if (active) {
            if (!el) {
                el = document.createElement('div');
                el.id = 'sholat-mode-screen';
                el.className = 'sholat-mode-overlay';
                el.innerHTML = `
                    <div class="sholat-mode-card">
                        <div class="sholat-mode-tag">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            <span>SHOLAT BERJAMAAH SEDANG BERLANGSUNG</span>
                        </div>
                        <div class="sholat-mode-arabic">اسْتَوُوا وَاعْتَدِلُوا وَتَرَاصُّوا</div>
                        <h2 class="sholat-mode-title">Luruskan &amp; Rapatkan Shaf</h2>
                        <p class="sholat-mode-sub">"Luruskan shaf-shaf kalian, karena meluruskan shaf merupakan bagian dari kesempurnaan shalat." (HR. Bukhari &amp; Muslim)</p>
                        <div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:12px; padding:10px 20px; color:#fca5a5; font-size:clamp(0.85rem,1.05vw,1.25rem); font-weight:700; display:flex; align-items:center; gap:8px;">
                            <span>📴 Harap Nonaktifkan Nada Dering / Silent Handphone Anda</span>
                        </div>
                    </div>
                `;
                document.body.appendChild(el);
            }
        } else {
            if (el) el.remove();
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
            // Reset to Default Modern Islamic Vector Background
            if (DOM.bgVideo) {
                DOM.bgVideo.pause();
                DOM.bgVideo.classList.add('hidden');
            }
            if (DOM.bgImage) {
                DOM.bgImage.style.backgroundImage = 'url("assets/images/bg-masjid-default.svg")';
                DOM.bgImage.style.backgroundSize = 'cover';
                DOM.bgImage.style.backgroundPosition = 'center center';
                DOM.bgImage.style.backgroundRepeat = 'no-repeat';
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

        // Load custom slide content from admin (untuk kartu ayat/hadits di sisi kanan)
        let slideContentMap = {};
        try {
            const slideContentItems = await FirestoreService.getCollection('slideContent', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (slideContentItems && slideContentItems.length > 0) {
                slideContentItems.forEach(sc => {
                    const key = sc.slideType || '';
                    if (!slideContentMap[key]) slideContentMap[key] = sc;
                });
            }
        } catch (e) {
            console.warn('[Display] SlideContent load:', e);
        }

        try {
            // Slide 1: Welcome (selalu tampil)
            slides.push(createWelcomeSlide(slideContentMap['welcome']));

            // Slide per Kajian (masing-masing 1 slide dengan poster)
            const kajian = await FirestoreService.getCollection('kajian', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (kajian && kajian.length > 0) {
                const kajianContent = slideContentMap['kajian'];
                kajian.forEach(k => {
                    slides.push(createSingleKajianSlide(k, kajianContent));
                });
            }

            // Slide per Kegiatan (Hanya tampilkan kegiatan yang belum lewat tanggalnya)
            const activities = await FirestoreService.getCollection('activities', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (activities && activities.length > 0) {
                const actContent = slideContentMap['activities'];
                const todayStr = new Date().toISOString().split('T')[0];
                activities.forEach(a => {
                    // Auto-hide kegiatan jika tanggalnya sudah lewat kemarin
                    if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.date < todayStr) {
                        return; // Lewat, sembunyikan otomatis
                    }
                    slides.push(createSingleActivitySlide(a, actContent));
                });
            }

            // Slide Petugas Salat Jumat (1 Bulan Penuh + Pekan Ini)
            const fridaySchedules = await FirestoreService.getCollection('fridaySchedules', {
                where: [['isActive', '==', true]],
                orderBy: 'date',
                orderDir: 'asc'
            });
            if (fridaySchedules && fridaySchedules.length > 0) {
                const nowStr = new Date().toISOString().split('T')[0];
                let currentFriday = fridaySchedules.find(f => (f.date || '') >= nowStr) || fridaySchedules[fridaySchedules.length - 1];
                slides.push(createFridaySlide(currentFriday, fridaySchedules));
            }

            // Slide Jadwal Sholat Tarawih 30 Malam (Hanya jika diaktifkan di Admin)
            try {
                const tarawih = await FirestoreService.getDocument('settings', 'tarawih');
                if (tarawih && tarawih.enabled === true && tarawih.nights && tarawih.nights.length > 0) {
                    slides.push(createTarawihSlide(tarawih));
                }
            } catch (tarawihErr) {
                console.warn('[Display] Tarawih load error:', tarawihErr);
            }

            // Slide Laporan Kas & QRIS Infaq
            const finance = await FirestoreService.getCollection('financeReports', {
                where: [['isActive', '==', true]],
                limit: 1
            });
            const qris = await FirestoreService.getCollection('qris', {
                where: [['isActive', '==', true]],
                limit: 1
            });
            if ((finance && finance.length > 0) || (qris && qris.length > 0)) {
                slides.push(createFinanceQRISSlide(finance ? finance[0] : null, qris ? qris[0] : null, slideContentMap['finance']));
            }

            // Slide Pengumuman (masing-masing 1 slide)
            const announcements = await FirestoreService.getCollection('announcements', {
                where: [['isActive', '==', true]],
                orderBy: 'order'
            });
            if (announcements && announcements.length > 0) {
                const annContent = slideContentMap['announcement'];
                announcements.forEach(ann => {
                    slides.push(createAnnouncementSlide(ann, annContent));
                });
            }

        } catch (err) {
            console.warn('[Display] Slide load error:', err);
        }

        // Ensure at least welcome slide is present
        if (slides.length === 0) {
            slides.push(createWelcomeSlide(null));
        }

        state.slides = slides;
        state.currentSlideIndex = 0;
        renderCurrentSlide();
        renderSlideIndicators();
    }

    // ── Helper: Buat kartu konten kanan (hanya jika ada data dari admin) ──
    function buildFeatureCard(content) {
        if (!content) return '';
        if (!content.badge && !content.arabic && !content.translation) return '';

        return `
            <div class="slide-right-col">
                <div class="feature-card">
                    ${content.badge ? `
                    <div class="card-header-badge">
                        <svg class="card-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="#facc15" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        <span>${escapeHtml(content.badge)}</span>
                    </div>` : ''}
                    ${content.arabic ? `<div class="card-arabic">${escapeHtml(content.arabic)}</div>` : ''}
                    ${content.translation ? `<div class="card-translation">${escapeHtml(content.translation)}</div>` : ''}
                    ${content.reference ? `<div class="card-ref">${escapeHtml(content.reference)}</div>` : ''}
                </div>
            </div>
        `;
    }

    // ── Slide Builders ──

    // 1. Welcome Slide
    function createWelcomeSlide(content) {
        const rightCol = buildFeatureCard(content);
        return {
            id: 'welcome',
            html: `
                <div class="slide slide-welcome ${!rightCol ? 'single-col' : ''}">
                    <div class="slide-left-col" ${!rightCol ? 'style="flex:1 1 100%; max-width:100%;"' : ''}>
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2c-.55 0-1 .45-1 1v1.1c-2.83.48-5 2.94-5 5.9 0 1.25.38 2.4 1.03 3.36L4 16v5h16v-5l-3.03-2.64c.65-.96 1.03-2.11 1.03-3.36 0-2.96-2.17-5.42-5-5.9V3c0-.55-.45-1-1-1zm-1 8h2v8h-2v-8z"/></svg>
                            <span>AHLAN WA SAHLAN • RUMAH ALLAH</span>
                        </div>
                        <div class="arabic-greeting">السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ</div>
                        <h2 class="welcome-heading">Selamat Datang di <span class="text-gold">Masjid Teraskota</span></h2>
                        <p class="welcome-subheading">Pusat Ibadah, Dakwah & Pembinaan Umat • BSD City</p>
                    </div>
                    ${rightCol}
                </div>
            `
        };
    }

    // 2. Single Kajian Slide (1 kajian = 1 slide, dengan poster atau kaligrafi mutiara ilmu)
    function createSingleKajianSlide(k, content) {
        const posterUrl = k.imageUrl || '';
        const hasPoster = posterUrl && posterUrl.length > 5;

        // Kolom kanan: murni poster jika ada poster, atau konten kustom, atau mutiara ilmu Islami
        let rightCol = '';
        if (hasPoster) {
            rightCol = `
                <div class="slide-right-col" style="display:flex; justify-content:center; align-items:center; height:100%; padding:0; background:none; border:none; box-shadow:none;">
                    <img src="${escapeHtml(posterUrl)}" alt="Poster ${escapeHtml(k.title)}" class="poster-only-img" onerror="this.closest('.slide-right-col').style.display='none'">
                </div>
            `;
        } else if (content) {
            rightCol = buildFeatureCard(content);
        } else {
            rightCol = buildFeatureCard({
                badge: 'MUTIARA ILMU',
                arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
                translation: '"Barangsiapa menempuh suatu jalan untuk mencari ilmu, maka Allah akan memudahkan baginya jalan menuju surga."',
                reference: '(HR. Muslim no. 2699)'
            });
        }

        const descText = k.description ? (k.description.length > 140 ? k.description.substring(0, 137) + '...' : k.description) : '';

        return {
            id: 'kajian-' + (k.id || ''),
            html: `
                <div class="slide slide-kajian ${!rightCol ? 'single-col' : ''}">
                    <div class="slide-left-col" ${!rightCol ? 'style="flex:1 1 100%; max-width:100%;"' : ''}>
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
                            <span>JADWAL KAJIAN ISLAM RUTIN</span>
                        </div>
                        <h2 class="slide-hero-title">${escapeHtml(k.title || 'Kajian Rutin')}</h2>
                        
                        <div class="slide-info-card">
                            <div class="slide-info-row speaker-row">
                                <span class="slide-info-label">NARASUMBER / PEMATERI</span>
                                <div class="slide-speaker-name">${escapeHtml(k.speaker || '-')}</div>
                            </div>

                            <div class="slide-meta-row">
                                <div class="slide-meta-item">
                                    <span class="slide-info-label">WAKTU PELAKSANAAN</span>
                                    <div class="slide-meta-val text-gold">📅 ${escapeHtml(k.day || '')} • Pukul ${escapeHtml(k.time || '')} WIB</div>
                                </div>
                                ${k.location ? `
                                <div class="slide-meta-item">
                                    <span class="slide-info-label">LOKASI / TEMPAT</span>
                                    <div class="slide-meta-val text-white">📍 ${escapeHtml(k.location)}</div>
                                </div>` : ''}
                            </div>

                            ${descText ? `
                            <div class="slide-desc-row">
                                <span class="slide-info-label">PEMBAHASAN / TEMA</span>
                                <p class="slide-desc-text">${escapeHtml(descText)}</p>
                            </div>` : ''}
                        </div>
                    </div>
                    ${rightCol}
                </div>
            `
        };
    }

    // 3. Single Activity Slide (1 kegiatan = 1 slide, dengan poster atau kaligrafi amalan terbaik)
    function createSingleActivitySlide(a, content) {
        const posterUrl = a.imageUrl || '';
        const hasPoster = posterUrl && posterUrl.length > 5;

        let rightCol = '';
        if (hasPoster) {
            rightCol = `
                <div class="slide-right-col" style="display:flex; justify-content:center; align-items:center; height:100%; padding:0; background:none; border:none; box-shadow:none;">
                    <img src="${escapeHtml(posterUrl)}" alt="Poster ${escapeHtml(a.title)}" class="poster-only-img" onerror="this.closest('.slide-right-col').style.display='none'">
                </div>
            `;
        } else if (content) {
            rightCol = buildFeatureCard(content);
        } else {
            rightCol = buildFeatureCard({
                badge: 'AMALAN TERBAIK',
                arabic: 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ',
                translation: '"Dan tolong-menolonglah kamu dalam mengerjakan kebajikan dan takwa, dan jangan tolong-menolong dalam berbuat dosa."',
                reference: '(QS. Al-Maidah: 2)'
            });
        }

        const descText = a.description ? (a.description.length > 140 ? a.description.substring(0, 137) + '...' : a.description) : '';

        return {
            id: 'activity-' + (a.id || ''),
            html: `
                <div class="slide slide-activities ${!rightCol ? 'single-col' : ''}">
                    <div class="slide-left-col" ${!rightCol ? 'style="flex:1 1 100%; max-width:100%;"' : ''}>
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                            <span>AGENDA &amp; KEGIATAN MASJID</span>
                        </div>
                        <h2 class="slide-hero-title">${escapeHtml(a.title || 'Kegiatan Masjid')}</h2>

                        <div class="slide-info-card">
                            ${a.speaker ? `
                            <div class="slide-info-row speaker-row">
                                <span class="slide-info-label">PENCERAMAH / PENGISI ACARA</span>
                                <div class="slide-speaker-name">${escapeHtml(a.speaker)}</div>
                            </div>` : ''}

                            <div class="slide-meta-row">
                                <div class="slide-meta-item">
                                    <span class="slide-info-label">TANGGAL &amp; WAKTU</span>
                                    <div class="slide-meta-val text-gold">📅 ${escapeHtml(a.date || '')} ${a.time ? '• ' + escapeHtml(a.time) + ' WIB' : ''}</div>
                                </div>
                                ${a.location ? `
                                <div class="slide-meta-item">
                                    <span class="slide-info-label">LOKASI / TEMPAT</span>
                                    <div class="slide-meta-val text-white">📍 ${escapeHtml(a.location)}</div>
                                </div>` : ''}
                            </div>

                            ${descText ? `
                            <div class="slide-desc-row">
                                <span class="slide-info-label">DESKRIPSI ACARA</span>
                                <p class="slide-desc-text">${escapeHtml(descText)}</p>
                            </div>` : ''}
                        </div>
                    </div>
                    ${rightCol}
                </div>
            `
        };
    }

    // ── Helper Date Formatting for Slides ──
    function formatDateShortID(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const day = parseInt(parts[2], 10);
            const mIdx = parseInt(parts[1], 10) - 1;
            return `${day} ${months[mIdx] || ''}`;
        }
        return dateStr;
    }

    function formatDateFullID(dateStr) {
        if (!dateStr) return 'Jumat Pekan Ini';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const day = parseInt(parts[2], 10);
            const mIdx = parseInt(parts[1], 10) - 1;
            const year = parts[0];
            return `${day} ${months[mIdx] || ''} ${year}`;
        }
        return dateStr;
    }

    // 4. Friday Schedule Slide (Dual Column: Pekan Ini + Tabel 1 Bulan Penuh)
    function createFridaySlide(item, allFridays) {
        const fridaysList = (allFridays && allFridays.length > 0) ? allFridays : [item];

        // Header bulan untuk tabel sebulan
        let monthHeader = 'SEBULAN';
        if (item && item.date) {
            const parts = item.date.split('-');
            if (parts.length === 3) {
                const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
                const mIdx = parseInt(parts[1], 10) - 1;
                monthHeader = `${months[mIdx] || ''} ${parts[0]}`;
            }
        }

        // Generate rows for full month table
        const tableRowsHtml = fridaysList.map(f => {
            const isCurrent = (f.date === item.date) || (f.id && item.id && f.id === item.id);
            return `
                <tr class="${isCurrent ? 'friday-row-active' : ''}">
                    <td style="white-space:nowrap;">
                        <span style="color:var(--gold); font-weight:800;">${formatDateShortID(f.date)}</span>
                        ${isCurrent ? '<span style="background:var(--emerald); color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:800; display:inline-block; vertical-align:middle;">PEKAN INI</span>' : ''}
                    </td>
                    <td><strong style="color:#ffffff;">${escapeHtml(f.khatib || '-')}</strong></td>
                    <td style="color:var(--text-white);">${escapeHtml(f.imam || '-')}</td>
                    <td style="color:var(--cyan-text); font-size:0.9em;">${escapeHtml(f.muazin || '-')}</td>
                </tr>
            `;
        }).join('');

        return {
            id: 'friday',
            html: `
                <div class="slide slide-friday" style="display:grid; grid-template-columns: 1fr 1.15fr; gap:2vw; align-items:center; height:100%;">
                    <!-- Kolom Kiri: Detail Petugas Jumat Terdekat / Pekan Ini -->
                    <div class="slide-left-col" style="padding-right:0.5vw;">
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2c-.55 0-1 .45-1 1v1.1c-2.83.48-5 2.94-5 5.9 0 1.25.38 2.4 1.03 3.36L4 16v5h16v-5l-3.03-2.64c.65-.96 1.03-2.11 1.03-3.36 0-2.96-2.17-5.42-5-5.9V3c0-.55-.45-1-1-1zm-1 8h2v8h-2v-8z"/></svg>
                            <span>SALAT JUMAT • PEKAN INI</span>
                        </div>
                        <h2 class="slide-hero-title" style="margin:2px 0 8px 0; font-size:clamp(1.3rem, 1.8vw, 2.2rem);">Petugas Salat Jumat</h2>
                        
                        <div class="slide-info-card" style="gap:8px;">
                            <div class="slide-meta-row">
                                <div class="slide-meta-item" style="padding:6px 12px;">
                                    <span class="slide-info-label" style="font-size:0.65rem;">WAKTU PELAKSANAAN</span>
                                    <div class="slide-meta-val text-gold" style="font-size:clamp(0.85rem, 1.05vw, 1.2rem);">📅 Jumat, ${formatDateFullID(item.date)}</div>
                                </div>
                            </div>

                            <div class="slide-info-row speaker-row" style="padding-left:12px; border-left:4px solid var(--gold);">
                                <span class="slide-info-label" style="font-size:0.65rem;">KHATIB JUMAT</span>
                                <div class="slide-speaker-name" style="color:var(--gold); font-size:clamp(1.2rem, 1.6vw, 2rem);">${escapeHtml(item.khatib || '-')}</div>
                            </div>

                            <div class="slide-meta-row">
                                <div class="slide-meta-item" style="padding:6px 12px; flex:1;">
                                    <span class="slide-info-label" style="font-size:0.65rem;">IMAM SALAT</span>
                                    <div class="slide-meta-val text-white" style="font-size:clamp(0.85rem, 1vw, 1.2rem);">👳 ${escapeHtml(item.imam || '-')}</div>
                                </div>
                                <div class="slide-meta-item" style="padding:6px 12px; flex:1;">
                                    <span class="slide-info-label" style="font-size:0.65rem;">MUAZIN / BILAL</span>
                                    <div class="slide-meta-val" style="color:var(--cyan-text); font-size:clamp(0.85rem, 1vw, 1.2rem);">📢 ${escapeHtml(item.muazin || '-')}</div>
                                </div>
                            </div>

                            ${item.tema ? `
                            <div class="slide-desc-row" style="padding:6px 12px; border:1px solid rgba(250,204,21,0.25);">
                                <span class="slide-info-label" style="font-size:0.65rem;">TEMA KHUTBAH</span>
                                <p class="slide-desc-text text-gold" style="font-size:clamp(0.8rem, 0.95vw, 1.1rem); line-height:1.35;">${escapeHtml(item.tema)}</p>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Kolom Kanan: Tabel Jadwal Sholat Jumat 1 Bulan Penuh -->
                    <div class="slide-right-col" style="height:100%; display:flex; align-items:center;">
                        <div class="friday-month-card">
                            <div style="color:var(--gold); font-size:clamp(0.72rem, 0.82vw, 0.95rem); font-weight:800; letter-spacing:0.8px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="#facc15"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                                <span>JADWAL PETUGAS JUMAT SEBULAN — ${monthHeader}</span>
                            </div>
                            <div style="overflow-x:auto; width:100%;">
                                <table class="friday-table">
                                    <thead>
                                        <tr>
                                            <th style="width:22%;">Tanggal</th>
                                            <th style="width:34%;">Khatib</th>
                                            <th style="width:24%;">Imam</th>
                                            <th style="width:20%;">Muazin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `
        };
    }

    // 4b. Tarawih 30 Nights Slide (Panoramic 3 Kolom Full)
    function createTarawihSlide(tarawih) {
        const title = tarawih.title || 'Jadwal Imam & Bilal Salat Tarawih';
        const yearHijri = tarawih.yearHijri || '1447 H / 2026 M';
        const nights = tarawih.nights || [];

        // 3 kolom @ 10 malam: Malam 1-10, Malam 11-20, Malam 21-30
        const col1 = nights.slice(0, 10);
        const col2 = nights.slice(10, 20);
        const col3 = nights.slice(20, 30);

        const renderCol = (group, titleText) => `
            <div class="tarawih-col">
                <div class="tarawih-col-title">${titleText}</div>
                <table class="tarawih-table">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(250,204,21,0.25); text-align:left; font-size:0.75rem; color:var(--gold);">
                            <th style="width:22%; padding:3px 4px;">Malam</th>
                            <th style="width:48%; padding:3px 4px;">Imam</th>
                            <th style="width:30%; padding:3px 4px;">Bilal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.map(n => `
                            <tr>
                                <td class="tarawih-night-num">Malam ${n.night}</td>
                                <td class="tarawih-imam">${escapeHtml(n.imam || '-')}</td>
                                <td class="tarawih-bilal">${escapeHtml(n.bilal || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        return {
            id: 'tarawih',
            html: `
                <div class="slide slide-tarawih">
                    <div class="tarawih-header">
                        <div>
                            <div class="welcome-tag" style="margin-bottom:4px;">
                                <svg class="tag-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12.3 2a10 10 0 0 0-1.9 20 10 10 0 0 0 8.6-4.9c.3-.5 0-1.1-.5-1.3-.5-.2-1.1 0-1.3.5A8 8 0 1 1 11.2 4c.5-.1.9-.6.8-1.1s-.6-.9-1.1-.9h1.4z"/></svg>
                                <span>SEMARAK RAMADHAN • ${escapeHtml(yearHijri)}</span>
                            </div>
                            <h2 class="slide-hero-title" style="margin:0; font-size:clamp(1.4rem, 1.8vw, 2.2rem);">${escapeHtml(title)}</h2>
                        </div>
                        <div class="card-header-badge" style="margin:0; background:rgba(250,204,21,0.12); border:1px solid var(--gold); border-radius:9999px; padding:6px 14px;">
                            <span>🌙 30 MALAM RAMADHAN PENUH</span>
                        </div>
                    </div>
                    <div class="tarawih-grid">
                        ${renderCol(col1, 'Malam 1 – 10 Ramadhan')}
                        ${renderCol(col2, 'Malam 11 – 20 Ramadhan')}
                        ${renderCol(col3, 'Malam 21 – 30 Ramadhan')}
                    </div>
                </div>
            `
        };
    }

    // 5. Finance & QRIS Slide
    function createFinanceQRISSlide(finance, qris, content) {
        // Hanya tampil angka jika ada data dari admin, bukan hardcoded
        const hasFinance = finance && (finance.saldo || finance.pemasukan || finance.pengeluaran);
        const saldoText = hasFinance ? `Rp ${(finance.saldo || 0).toLocaleString('id-ID')}` : '-';
        const pemasukanText = hasFinance ? `Rp ${(finance.pemasukan || 0).toLocaleString('id-ID')}` : '-';
        const pengeluaranText = hasFinance ? `Rp ${(finance.pengeluaran || 0).toLocaleString('id-ID')}` : '-';
        const qrisImg = (qris && qris.imageUrl) ? qris.imageUrl : '';
        const hasQris = qrisImg && qrisImg.length > 5;

        // Kolom kanan: QRIS jika ada, atau konten kustom
        let rightCol = '';
        if (hasQris) {
            rightCol = `
                <div class="slide-right-col">
                    <div class="feature-card">
                        <div class="card-header-badge">
                            <svg class="card-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="#facc15" aria-hidden="true"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z"/></svg>
                            <span>INFAQ DIGITAL QRIS</span>
                        </div>
                        <div style="background:#ffffff; border-radius:16px; padding:12px; display:inline-block; margin-bottom:10px;">
                            <img src="${qrisImg}" alt="QRIS Infaq" style="width:clamp(170px, 12vw, 210px); height:clamp(170px, 12vw, 210px); object-fit:contain; display:block;">
                        </div>
                        <div class="card-translation" style="font-size:clamp(0.85rem, 0.95vw, 1.15rem); margin-bottom:4px; font-weight:600;">Scan QRIS menggunakan Mobile Banking atau e-Wallet</div>
                        ${qris && qris.label ? `<div class="card-ref">${escapeHtml(qris.label)}</div>` : ''}
                    </div>
                </div>
            `;
        } else if (content) {
            rightCol = buildFeatureCard(content);
        }

        return {
            id: 'finance-qris',
            html: `
                <div class="slide slide-finance ${!rightCol ? 'single-col' : ''}">
                    <div class="slide-left-col" ${!rightCol ? 'style="flex:1 1 100%; max-width:100%;"' : ''}>
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                            <span>LAPORAN KAS & ZISWAF</span>
                        </div>
                        <h2 class="welcome-heading">Transparansi Keuangan</h2>
                        ${hasFinance ? `
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
                        ` : `
                        <p class="welcome-subheading" style="margin-top:12px;">Data keuangan belum tersedia.</p>
                        `}
                    </div>
                    ${rightCol}
                </div>
            `
        };
    }

    // 6. Announcement Slide
    function createAnnouncementSlide(ann, content) {
        const rightCol = buildFeatureCard(content);
        return {
            id: 'announcement-' + (ann.id || ''),
            html: `
                <div class="slide slide-announcement ${!rightCol ? 'single-col' : ''}">
                    <div class="slide-left-col" ${!rightCol ? 'style="flex:1 1 100%; max-width:100%;"' : ''}>
                        <div class="welcome-tag">
                            <svg class="tag-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
                            <span>PENGUMUMAN DKM</span>
                        </div>
                        <h2 class="welcome-heading">${escapeHtml(ann.title || 'Warta Masjid')}</h2>
                        <p class="welcome-subheading" style="color:#ffffff; font-weight:500; font-size:1.2rem; margin-top:10px;">
                            ${escapeHtml(ann.content || '')}
                        </p>
                    </div>
                    ${rightCol}
                </div>
            `
        };
    }

    // ── Slide Controller & Interactive Navigation ──
    function goToSlide(index) {
        if (!state.slides || state.slides.length === 0) return;
        state.currentSlideIndex = (index + state.slides.length) % state.slides.length;
        renderCurrentSlide();
        restartSlideTimer();
    }

    function nextSlide() {
        goToSlide(state.currentSlideIndex + 1);
    }

    function prevSlide() {
        goToSlide(state.currentSlideIndex - 1);
    }

    function restartSlideTimer() {
        if (state.slideInterval) clearInterval(state.slideInterval);
        state.slideInterval = setInterval(() => {
            if (state.slides.length <= 1) return;
            state.currentSlideIndex = (state.currentSlideIndex + 1) % state.slides.length;
            renderCurrentSlide();
        }, state.slideDuration);
    }

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

        state.slides.forEach((slide, idx) => {
            const dot = document.createElement('span');
            dot.className = `indicator-dot ${idx === state.currentSlideIndex ? 'active' : ''}`;
            dot.title = `Lompat ke slide ${idx + 1} (${slide.id || 'Slide'})`;
            dot.setAttribute('role', 'button');
            dot.setAttribute('tabindex', '0');
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                goToSlide(idx);
            });
            DOM.slideIndicators.appendChild(dot);
        });
    }

    function startSlideShow() {
        restartSlideTimer();
    }

    // ── 6. Realtime Updates, TV Remote & User Controls ──
    function subscribeToUpdates() {
        let _loadSlidesTimer = null;
        const debouncedLoadSlides = () => {
            if (_loadSlidesTimer) clearTimeout(_loadSlidesTimer);
            _loadSlidesTimer = setTimeout(() => {
                loadSlides();
            }, 400);
        };

        // 1. Online Firestore listeners
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

            FirestoreService.listenDocument('settings', 'prayerConfig', (data) => {
                if (data) {
                    PrayerTimesService.setConfig(data);
                    if (data.timezoneLabel || data.timezone) {
                        state.settings = { ...(state.settings || {}), timezone: data.timezone || state.settings?.timezone, timezoneLabel: data.timezoneLabel || state.settings?.timezoneLabel };
                        updateTimezoneLabel();
                        startClock();
                        updateDates();
                    }
                    loadPrayerTimes();
                }
            });

            FirestoreService.listenDocument('settings', 'tarawih', debouncedLoadSlides);

            FirestoreService.listenCollection('kajian', debouncedLoadSlides);
            FirestoreService.listenCollection('activities', debouncedLoadSlides);
            FirestoreService.listenCollection('announcements', debouncedLoadSlides);
            FirestoreService.listenCollection('fridaySchedules', debouncedLoadSlides);
            FirestoreService.listenCollection('financeReports', debouncedLoadSlides);
            FirestoreService.listenCollection('qris', debouncedLoadSlides);
            FirestoreService.listenCollection('slideContent', debouncedLoadSlides);
        }

        // 2. Cross-tab LocalStorage & Local Change sync (Works instantly in demo mode & local server)
        let _localSyncTimer = null;
        const handleLocalSync = (evt) => {
            if (!evt.key || evt.key.startsWith('masjid_')) {
                // Apply background instantly if present
                try {
                    const localBg = localStorage.getItem('masjid_bg_settings');
                    if (localBg) applyBackgroundSettings(JSON.parse(localBg));
                } catch(e) {}
                updateTimezoneLabel();

                if (_localSyncTimer) clearTimeout(_localSyncTimer);
                _localSyncTimer = setTimeout(() => {
                    console.info('[Display] Local change detected. Syncing display...');
                    loadSettings();
                    loadPrayerTimes();
                    debouncedLoadSlides();
                }, 200);
            }
        };

        window.addEventListener('storage', handleLocalSync);
        window.addEventListener('masjid-data-update', handleLocalSync);

        // 3. Keyboard & Smart TV Remote Control Navigation
        document.addEventListener('keydown', (e) => {
            // Check if user is typing in an input
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

            switch (e.key) {
                // Next slide (Panah kanan, panah bawah, page down, TV Next)
                case 'ArrowRight':
                case 'ArrowDown':
                case 'PageDown':
                case 'MediaTrackNext':
                    e.preventDefault();
                    nextSlide();
                    break;

                // Prev slide (Panah kiri, panah atas, page up, TV Prev)
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'PageUp':
                case 'MediaTrackPrevious':
                    e.preventDefault();
                    prevSlide();
                    break;

                // Home: Slide pertama
                case 'Home':
                    e.preventDefault();
                    goToSlide(0);
                    break;

                // End: Slide terakhir
                case 'End':
                    e.preventDefault();
                    goToSlide(state.slides.length - 1);
                    break;

                // Spasi / OK remote: Next slide
                case ' ':
                    e.preventDefault();
                    nextSlide();
                    break;

                // Fullscreen toggle ('F' key)
                case 'f':
                case 'F':
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => { });
                    } else {
                        document.exitFullscreen().catch(() => { });
                    }
                    break;
            }
        });

        // 4. Mouse Wheel Navigation (Scroll untuk ganti slide)
        let _lastWheel = 0;
        window.addEventListener('wheel', (e) => {
            const now = Date.now();
            if (now - _lastWheel < 350) return;
            if (Math.abs(e.deltaY) > 25 || Math.abs(e.deltaX) > 25) {
                _lastWheel = now;
                if (e.deltaY > 0 || e.deltaX > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
        }, { passive: true });

        // 5. Mouse Click & Touch Swipe Navigation on Slide Area
        if (DOM.slideContent) {
            DOM.slideContent.addEventListener('click', (e) => {
                if (e.target.closest('a, button, input, .indicator-dot, .friday-table, .tarawih-table')) return;
                const rect = DOM.slideContent.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                // Click on left 35% -> prev slide, right 65% -> next slide
                if (clickX < rect.width * 0.35) {
                    prevSlide();
                } else {
                    nextSlide();
                }
            });

            // Touch Swipe Support
            let startTouchX = 0;
            DOM.slideContent.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length > 0) startTouchX = e.touches[0].clientX;
            }, { passive: true });

            DOM.slideContent.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    const diff = e.changedTouches[0].clientX - startTouchX;
                    if (Math.abs(diff) > 40) {
                        if (diff < 0) nextSlide();
                        else prevSlide();
                    }
                }
            }, { passive: true });
        }

        // 6. Fullscreen Toggle on Double-Click
        document.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            } else {
                document.exitFullscreen().catch(() => { });
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
        loadPrayerTimes,
        goToSlide,
        nextSlide,
        prevSlide
    };

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
