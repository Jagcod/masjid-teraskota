/**
 * Prayer Times Service - Masjid Teraskota
 * 
 * Sources:
 * 1. Primary: Aladhan API (https://aladhan.com/prayer-times-api)
 *    - Method 20 = Kementerian Agama Republik Indonesia
 *    - Provides calculated prayer times based on coordinates
 * 2. Fallback: Manual schedule from Firestore (admin-configurable)
 * 3. Last resort: Cached data from localStorage
 * 
 * Timezone: Asia/Jakarta (WIB, UTC+7)
 */

const PrayerTimesService = (() => {
    'use strict';

    // Default location: Tangerang Selatan (approximate Teraskota area)
    const DEFAULT_CONFIG = {
        latitude: -6.3000,
        longitude: 106.6700,
        method: 20, // Kemenag RI
        city: 'Tangerang Selatan',
        timezone: 'Asia/Jakarta'
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
    const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

    let _config = { ...DEFAULT_CONFIG };
    let _todayTimes = null;
    let _lastFetchDate = null;

    /**
     * Set location config (can be loaded from Firestore settings)
     */
    function setConfig(config) {
        if (config) {
            _config = { ...DEFAULT_CONFIG, ...config };
        }
    }

    /**
     * Fetch prayer times from Aladhan API
     */
    async function fetchFromAPI(date) {
        const d = date || new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();

        const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${_config.latitude}&longitude=${_config.longitude}&method=${_config.method}&shafpiaq=1`;

        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(10000) // 10s timeout
            });
            
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const data = await response.json();

            if (data.code !== 200 || !data.data || !data.data.timings) {
                throw new Error('Invalid API response structure');
            }

            const timings = data.data.timings;
            const result = {};

            // Map API keys to our keys
            for (const [apiKey, ourKey] of Object.entries(API_PRAYER_MAP)) {
                const timeStr = timings[apiKey];
                if (timeStr) {
                    // Remove timezone info like " (WIB)"
                    result[ourKey] = timeStr.replace(/\s*\(.*\)/, '').trim();
                }
            }

            // Calculate Dhuha (approximately 15 minutes after Sunrise)
            if (result.terbit) {
                result.dhuha = addMinutesToTime(result.terbit, 15);
            }

            // Cache the result
            cacheResult(result, `${yyyy}-${mm}-${dd}`);

            return result;
        } catch (error) {
            console.warn('[PrayerTimes] API fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Get prayer times for today
     */
    async function getTodayTimes() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Return cached if same day
        if (_todayTimes && _lastFetchDate === todayStr) {
            return _todayTimes;
        }

        // Try API first
        let times = await fetchFromAPI(today);

        // If API fails, try localStorage cache
        if (!times) {
            times = getCachedResult(todayStr);
        }

        // If no cache, use hardcoded fallback (approximate times for Tangerang area)
        if (!times) {
            console.warn('[PrayerTimes] Using fallback times.');
            times = getFallbackTimes();
        }

        _todayTimes = times;
        _lastFetchDate = todayStr;

        return times;
    }

    /**
     * Get manual/overridden times from Firestore
     */
    async function getManualOverrides() {
        if (!window.FirestoreService) return null;
        try {
            const overrides = await window.FirestoreService.getDocument('settings', 'prayerOverrides');
            if (overrides && overrides.enabled && overrides.times) {
                return overrides.times;
            }
        } catch (e) {
            // Ignore - manual overrides are optional
        }
        return null;
    }

    /**
     * Get prayer times with manual overrides applied
     */
    async function getTimesWithOverrides() {
        const apiTimes = await getTodayTimes();
        const overrides = await getManualOverrides();

        if (overrides) {
            // Merge: manual overrides take precedence
            const merged = { ...apiTimes };
            for (const key of PRAYER_KEYS) {
                if (overrides[key] && overrides[key].trim()) {
                    merged[key] = overrides[key].trim();
                }
            }
            return merged;
        }

        return apiTimes;
    }

    /**
     * Determine the next prayer and time remaining
     */
    function getNextPrayer(times) {
        if (!times) return null;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = now.getSeconds();

        // 7 display prayer cards in chronological sequence
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

        // Check if there is an upcoming prayer today
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
                    countdown: {
                        hours: hours,
                        minutes: mins,
                        seconds: secs
                    },
                    totalMinutes: Math.floor(totalSecs / 60),
                    isTomorrow: false
                };
            }
        }

        // After Isya - next prayer is tomorrow's first prayer (Imsak or Subuh)
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
            countdown: {
                hours: hours,
                minutes: mins,
                seconds: secs
            },
            totalMinutes: Math.floor(totalSecs / 60),
            isTomorrow: true
        };
    }

    /**
     * Determine active/current prayer period
     * A prayer is "active" from its time until the next prayer time
     */
    function getActivePrayer(times) {
        if (!times) return null;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const orderedPrayers = ['subuh', 'terbit', 'dhuha', 'dzuhur', 'ashar', 'maghrib', 'isya'];
        
        let activePrayer = null;

        for (let i = orderedPrayers.length - 1; i >= 0; i--) {
            const key = orderedPrayers[i];
            const timeStr = times[key];
            if (!timeStr) continue;

            const [h, m] = timeStr.split(':').map(Number);
            const prayerMinutes = h * 60 + m;

            if (currentMinutes >= prayerMinutes) {
                activePrayer = key;
                break;
            }
        }

        return activePrayer;
    }

    // ── Utility Functions ──

    function addMinutesToTime(timeStr, minutes) {
        const [h, m] = timeStr.split(':').map(Number);
        let totalMin = h * 60 + m + minutes;
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    function cacheResult(times, dateStr) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                date: dateStr,
                times: times,
                timestamp: Date.now()
            }));
        } catch (e) {
            // localStorage might be unavailable
        }
    }

    function getCachedResult(dateStr) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            if (data.date === dateStr && (Date.now() - data.timestamp) < CACHE_DURATION) {
                console.info('[PrayerTimes] Using cached data.');
                return data.times;
            }
        } catch (e) {
            // Ignore cache errors
        }
        return null;
    }

    function getFallbackTimes() {
        // Approximate prayer times for Tangerang Selatan area
        // These should only be used when API and cache are unavailable
        return {
            imsak: '04:25',
            subuh: '04:35',
            terbit: '05:50',
            dhuha: '06:05',
            dzuhur: '11:55',
            ashar: '15:15',
            maghrib: '17:55',
            isya: '19:05'
        };
    }

    function getPrayerKeys() {
        return [...PRAYER_KEYS];
    }

    function getConfig() {
        return { ..._config };
    }

    /**
     * Force refresh (clear cache and refetch)
     */
    async function refresh() {
        _todayTimes = null;
        _lastFetchDate = null;
        try { localStorage.removeItem(CACHE_KEY); } catch(e) {}
        return await getTodayTimes();
    }

    return {
        setConfig,
        getTodayTimes,
        getTimesWithOverrides,
        getNextPrayer,
        getActivePrayer,
        getPrayerKeys,
        getConfig,
        refresh
    };
})();

window.PrayerTimesService = PrayerTimesService;
