/**
 * Prayer Times Service - Masjid Teraskota
 * 
 * Mendukung:
 * 1. Perhitungan Otomatis: API Aladhan (Metode Kemenag RI / Koordinat Kota)
 * 2. Input Manual / Override: Waktu sholat bisa disetel langsung dari panel admin
 * 3. Multi-Zona Waktu: WIB (Asia/Jakarta), WITA (Asia/Makassar), WIT (Asia/Jayapura)
 * 4. Jam Digital Sholat: Hitung mundur sholat berikutnya & penanda waktu sholat aktif
 * 5. Caching & Fallback Cepat: Tampilan langsung siap tanpa menunggu loading API
 */

const PrayerTimesService = (() => {
    'use strict';

    const DEFAULT_CONFIG = {
        latitude: -6.3000,
        longitude: 106.6700,
        method: 20, // Kemenag RI
        city: 'Tangerang Selatan',
        timezone: 'Asia/Jakarta',
        timezoneLabel: 'WIB (JAKARTA)',
        ihtiyatMinutes: 2 // Standar pengaman waktu sholat Kemenag
    };

    const PRAYER_KEYS = ['imsak', 'subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];

    const API_PRAYER_MAP = {
        'Imsak': 'imsak',
        'Fajr': 'subuh',
        'Sunrise': 'terbit',
        'Dhuhr': 'dzuhur',
        'Asr': 'ashar',
        'Maghrib': 'maghrib',
        'Isha': 'isya'
    };

    const CACHE_KEY = 'masjid_prayer_cache';
    const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 jam

    let _config = { ...DEFAULT_CONFIG };
    let _todayTimes = null;
    let _lastFetchDate = null;
    let _isFetching = false;

    function setConfig(config) {
        if (config) {
            _config = { ...DEFAULT_CONFIG, ...config };
        }
    }

    function getConfig() {
        return { ..._config };
    }

    /**
     * Dapatkan waktu saat ini sesuai zona waktu masjid
     */
    function getNowTime(tz) {
        const timezone = tz || _config.timezone || 'Asia/Jakarta';
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour12: false,
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            });
            const parts = formatter.formatToParts(now);
            let h = 0, m = 0, s = 0;
            for (const p of parts) {
                if (p.type === 'hour') h = parseInt(p.value, 10);
                if (p.type === 'minute') m = parseInt(p.value, 10);
                if (p.type === 'second') s = parseInt(p.value, 10);
            }
            if (h === 24) h = 0;
            return {
                hours: h,
                minutes: m,
                seconds: s,
                totalMinutes: h * 60 + m
            };
        } catch (e) {
            const d = new Date();
            return {
                hours: d.getHours(),
                minutes: d.getMinutes(),
                seconds: d.getSeconds(),
                totalMinutes: d.getHours() * 60 + d.getMinutes()
            };
        }
    }

    /**
     * Waktu cadangan standar (realistis wilayah Tangerang / Jakarta / WIB)
     */
    function getFallbackTimes() {
        return {
            imsak: '04:18',
            subuh: '04:28',
            terbit: '05:43',
            dhuha: '06:05',
            dzuhur: '11:49',
            ashar: '15:05',
            maghrib: '17:51',
            isya: '19:01'
        };
    }

    /**
     * Ambil override manual dari admin (Firestore atau LocalStorage)
     */
    async function getManualOverrides() {
        try {
            if (window.FirestoreService) {
                const overrides = await window.FirestoreService.getDocument('settings', 'prayerOverrides');
                if (overrides && overrides.enabled && overrides.times) {
                    return overrides.times;
                }
            }
        } catch (e) {}

        try {
            const local = localStorage.getItem('masjid_prayer_overrides');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && parsed.enabled && parsed.times) {
                    return parsed.times;
                }
            }
        } catch (e) {}

        return null;
    }

    /**
     * Ambil data dari cache lokal
     */
    function getCachedResult(dateStr) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.date === dateStr && (Date.now() - data.timestamp) < CACHE_DURATION) {
                return data.times;
            }
        } catch (e) {}
        return null;
    }

    function cacheResult(times, dateStr) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                date: dateStr,
                times: times,
                timestamp: Date.now()
            }));
        } catch (e) {}
    }

    /**
     * Fetch dari Aladhan API dengan batas waktu 3 detik agar tidak memblokir UI
     */
    async function fetchFromAPI(date) {
        const d = date || new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();

        const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${_config.latitude}&longitude=${_config.longitude}&method=${_config.method}&shafpiaq=1`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s max

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('API status ' + response.status);

            const json = await response.json();
            if (json.code !== 200 || !json.data || !json.data.timings) {
                throw new Error('Struktur data API tidak valid');
            }

            const timings = json.data.timings;
            const result = {};

            for (const [apiKey, ourKey] of Object.entries(API_PRAYER_MAP)) {
                const timeStr = timings[apiKey];
                if (timeStr && typeof timeStr === 'string') {
                    result[ourKey] = timeStr.replace(/\s*\(.*\)/, '').trim();
                }
            }

            if (result.terbit && !result.dhuha) {
                result.dhuha = addMinutesToTime(result.terbit, 20);
            }

            cacheResult(result, `${yyyy}-${mm}-${dd}`);
            return result;
        } catch (err) {
            console.warn('[PrayerTimes] Fetch API Aladhan tidak berhasil/timeout:', err.message);
            return null;
        }
    }

    /**
     * Dapatkan jadwal sholat hari ini (mengutamakan kecepatan render instan)
     */
    async function getTodayTimes() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (_todayTimes && _lastFetchDate === todayStr) {
            return _todayTimes;
        }

        // Cek cache dulu agar instan
        let times = getCachedResult(todayStr);

        // Jika tidak ada cache, gunakan fallback default dulu seketika
        if (!times) {
            times = getFallbackTimes();
        }

        _todayTimes = times;
        _lastFetchDate = todayStr;

        // Jalankan fetch background tanpa memblokir
        if (!_isFetching) {
            _isFetching = true;
            fetchFromAPI(today).then(apiTimes => {
                _isFetching = false;
                if (apiTimes) {
                    _todayTimes = apiTimes;
                    window.dispatchEvent(new CustomEvent('masjid-prayer-updated', { detail: apiTimes }));
                }
            }).catch(() => { _isFetching = false; });
        }

        return times;
    }

    /**
     * Dapatkan waktu sholat hari ini dengan override manual dari admin jika diaktifkan
     */
    async function getTimesWithOverrides() {
        // Cek prayer config dari Firestore jika ada
        try {
            if (window.FirestoreService) {
                const cfg = await window.FirestoreService.getDocument('settings', 'prayerConfig');
                if (cfg) setConfig(cfg);
            }
        } catch(e) {}

        const baseTimes = await getTodayTimes();
        const overrides = await getManualOverrides();

        if (overrides) {
            const merged = { ...baseTimes };
            let hasValidOverride = false;
            for (const key of PRAYER_KEYS) {
                if (typeof overrides[key] === 'string' && overrides[key].trim()) {
                    merged[key] = overrides[key].trim();
                    hasValidOverride = true;
                }
            }
            if (hasValidOverride) return merged;
        }

        return baseTimes;
    }

    /**
     * Hitung waktu sholat berikutnya & sisa hitung mundur berdasarkan zona waktu yang aktif
     */
    function getNextPrayer(times, targetTimezone) {
        if (!times) return null;

        const tz = targetTimezone || _config.timezone || 'Asia/Jakarta';
        const now = getNowTime(tz);
        const currentMinutes = now.totalMinutes;
        const currentSeconds = now.seconds;

        const prayerOrder = ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
        const prayerLabels = {
            imsak: 'Imsak',
            subuh: 'Subuh',
            terbit: 'Terbit',
            dzuhur: 'Dzuhur',
            ashar: 'Ashar',
            maghrib: 'Maghrib',
            isya: "Isya'"
        };

        // Cari waktu sholat berikutnya hari ini
        for (const key of prayerOrder) {
            const timeStr = times[key];
            if (!timeStr) continue;

            const [h, m] = timeStr.split(':').map(Number);
            const prayerMinutes = h * 60 + m;

            if (prayerMinutes > currentMinutes || (prayerMinutes === currentMinutes && currentSeconds === 0)) {
                let totalSecs = (prayerMinutes - currentMinutes) * 60 - currentSeconds;
                if (totalSecs < 0) totalSecs = 0;

                const hours = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;

                return {
                    key: key,
                    name: prayerLabels[key] || key,
                    time: timeStr,
                    countdown: { hours, minutes: mins, seconds: secs },
                    totalSeconds: totalSecs,
                    isTomorrow: false
                };
            }
        }

        // Jika setelah Isya, waktu sholat berikutnya adalah Imsak/Subuh esok hari
        const firstKey = times.imsak ? 'imsak' : 'subuh';
        const firstTimeStr = times[firstKey] || '04:18';
        const [nextH, nextM] = firstTimeStr.split(':').map(Number);
        const nextDayMinutes = (24 * 60 - currentMinutes) + (nextH * 60 + nextM);
        let totalSecs = nextDayMinutes * 60 - currentSeconds;
        if (totalSecs < 0) totalSecs = 0;

        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        return {
            key: firstKey,
            name: prayerLabels[firstKey] || firstKey,
            time: firstTimeStr,
            countdown: { hours, minutes: mins, seconds: secs },
            totalSeconds: totalSecs,
            isTomorrow: true
        };
    }

    /**
     * Sholat yang saat ini sedang berlangsung / baru saja masuk
     */
    function getActivePrayer(times, targetTimezone) {
        if (!times) return null;
        const tz = targetTimezone || _config.timezone || 'Asia/Jakarta';
        const now = getNowTime(tz);
        const currentMinutes = now.totalMinutes;

        const orderedPrayers = ['subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
        let active = null;
        for (let i = orderedPrayers.length - 1; i >= 0; i--) {
            const key = orderedPrayers[i];
            const timeStr = times[key];
            if (!timeStr) continue;

            const [h, m] = timeStr.split(':').map(Number);
            if (currentMinutes >= (h * 60 + m)) {
                active = key;
                break;
            }
        }
        return active;
    }

    function addMinutesToTime(timeStr, minutes) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        let totalMin = h * 60 + m + minutes;
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    return {
        setConfig,
        getConfig,
        getNowTime,
        getTodayTimes,
        getTimesWithOverrides,
        getNextPrayer,
        getActivePrayer,
        getFallbackTimes,
        PRAYER_KEYS
    };
})();

window.PrayerTimesService = PrayerTimesService;
