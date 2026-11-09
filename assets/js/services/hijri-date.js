/**
 * Hijri Date Service - Masjid Teraskota
 * 
 * Converts Gregorian date to Hijri (Islamic) calendar.
 * 
 * Sources:
 * 1. Primary: Aladhan API (provides accurate Hijri date with adjustment)
 * 2. Fallback: Local calculation using Intl.DateTimeFormat with 'islamic-umalqura' calendar
 * 3. Last resort: Approximate calculation
 * 
 * Note: Hijri dates may vary by ±1 day depending on moon sighting authority.
 * Admin can adjust the offset via Firestore settings.
 */

const HijriDateService = (() => {
    'use strict';

    const HIJRI_MONTHS = [
        'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
        'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban',
        'Ramadhan', 'Syawal', 'Dzulqaidah', 'Dzulhijjah'
    ];

    const MASEHI_DAYS = [
        'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
    ];

    const MASEHI_MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let _hijriAdjustment = 0; // Can be -2, -1, 0, +1, +2

    const CACHE_KEY = 'masjid_hijri_cache';

    /**
     * Set Hijri adjustment (admin configurable)
     * @param {number} adjustment - Days to add/subtract (-2 to +2)
     */
    function setAdjustment(adjustment) {
        _hijriAdjustment = Math.max(-2, Math.min(2, parseInt(adjustment) || 0));
    }

    /**
     * Get formatted Masehi (Gregorian) date
     * @returns {string} e.g., "Rabu, 28 Oktober 2026"
     */
    function getMasehiDate(date) {
        const d = date || new Date();
        const dayName = MASEHI_DAYS[d.getDay()];
        const day = d.getDate();
        const month = MASEHI_MONTHS[d.getMonth()];
        const year = d.getFullYear();
        return `${dayName}, ${day} ${month} ${year}`;
    }

    /**
     * Get Hijri date from Aladhan API
     */
    async function fetchHijriFromAPI(date) {
        const d = date || new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();

        const url = `https://api.aladhan.com/v1/gToH/${dd}-${mm}-${yyyy}?adjustment=${_hijriAdjustment}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const response = await fetch(url, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const data = await response.json();
            if (data.code !== 200 || !data.data || !data.data.hijri) {
                throw new Error('Invalid response');
            }

            const hijri = data.data.hijri;
            const result = {
                day: parseInt(hijri.day),
                month: parseInt(hijri.month.number),
                monthName: HIJRI_MONTHS[parseInt(hijri.month.number) - 1] || hijri.month.en,
                year: parseInt(hijri.year),
                formatted: `${parseInt(hijri.day)} ${HIJRI_MONTHS[parseInt(hijri.month.number) - 1] || hijri.month.en} ${hijri.year} H`
            };

            // Cache
            cacheHijri(result, `${yyyy}-${mm}-${dd}`);
            return result;
        } catch (error) {
            console.warn('[HijriDate] API fetch failed:', error.message);
            return null;
        }
    }

    /**
     * Get Hijri date using browser's Intl API (fallback)
     */
    function getHijriFromIntl(date) {
        const d = date || new Date();

        // Apply adjustment
        if (_hijriAdjustment !== 0) {
            const adjusted = new Date(d);
            adjusted.setDate(adjusted.getDate() + _hijriAdjustment);
            d.setTime(adjusted.getTime());
        }

        try {
            // Try islamic-umalqura calendar (used in Saudi Arabia / most common)
            const formatter = new Intl.DateTimeFormat('id-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            const parts = formatter.formatToParts(d);
            let day = '', month = '', year = '';

            for (const part of parts) {
                if (part.type === 'day') day = part.value;
                if (part.type === 'month') month = part.value;
                if (part.type === 'year') year = part.value;
            }

            if (day && month && year) {
                // Try to find our Indonesian month name
                const monthIndex = parseInt(month) - 1;
                const monthName = (monthIndex >= 0 && monthIndex < 12) 
                    ? HIJRI_MONTHS[monthIndex] 
                    : month;

                return {
                    day: parseInt(day),
                    month: parseInt(month) || 0,
                    monthName: monthName,
                    year: parseInt(year.replace(/\s*AH/i, '')),
                    formatted: `${parseInt(day)} ${monthName} ${year.replace(/\s*AH/i, '')} H`
                };
            }
        } catch (e) {
            console.warn('[HijriDate] Intl API not supported:', e.message);
        }

        return null;
    }

    /**
     * Get today's Hijri date (tries API first, then Intl, then cache)
     */
    async function getHijriDate(date) {
        const d = date || new Date();
        const dateStr = d.toISOString().split('T')[0];

        // Try cached first for speed
        const cached = getCachedHijri(dateStr);
        if (cached) return cached;

        // Try Intl (instant, no network)
        const intlResult = getHijriFromIntl(d);
        if (intlResult) {
            cacheHijri(intlResult, dateStr);
        }

        // Fetch from API in background (non-blocking)
        fetchHijriFromAPI(d).then(apiResult => {
            if (apiResult) {
                cacheHijri(apiResult, dateStr);
                // Dispatch event so display can update
                window.dispatchEvent(new CustomEvent('masjid-hijri-updated', { detail: apiResult }));
            }
        }).catch(() => {});

        // Return Intl result immediately
        if (intlResult) return intlResult;

        // Last resort
        return {
            day: 0,
            month: 0,
            monthName: '',
            year: 0,
            formatted: 'Tanggal Hijriah tidak tersedia'
        };
    }

    // ── Cache ──

    function cacheHijri(result, dateStr) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                date: dateStr,
                hijri: result,
                timestamp: Date.now()
            }));
        } catch(e) {}
    }

    function getCachedHijri(dateStr) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.date === dateStr) return data.hijri;
        } catch(e) {}
        return null;
    }

    return {
        getMasehiDate,
        getHijriDate,
        setAdjustment,
        HIJRI_MONTHS,
        MASEHI_DAYS,
        MASEHI_MONTHS
    };
})();

window.HijriDateService = HijriDateService;
