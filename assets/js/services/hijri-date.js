/**
 * Hijri Date Service - Masjid Teraskota
 * 
 * Converts Gregorian date to Hijri (Islamic) calendar.
 * 
 * Sources:
 * 1. Primary: Aladhan API (provides accurate Hijri date with adjustment)
 * 2. Secondary: Browser Intl API with 'islamic-umalqura' calendar
 * 3. Offline Guarantee: Built-in Kuwaiti Algorithm (calculated in 0 ms, works on any Smart TV/offline)
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

    function setAdjustment(adjustment) {
        _hijriAdjustment = Math.max(-2, Math.min(2, parseInt(adjustment) || 0));
    }

    function getMasehiDate(date) {
        const d = date || new Date();
        const dayName = MASEHI_DAYS[d.getDay()];
        const day = d.getDate();
        const month = MASEHI_MONTHS[d.getMonth()];
        const year = d.getFullYear();
        return `${dayName}, ${day} ${month} ${year}`;
    }

    /**
     * Hitung Kalender Hijriah secara Matematis (Offline Guarantee)
     * Tidak membutuhkan internet, langsung tersedia dalam 0 milidetik
     */
    function calculateHijriOffline(date) {
        const d = date ? new Date(date) : new Date();
        if (_hijriAdjustment !== 0) {
            d.setDate(d.getDate() + _hijriAdjustment);
        }

        let day = d.getDate();
        let month = d.getMonth();
        let year = d.getFullYear();

        let m = month + 1;
        let y = year;
        if (m < 3) {
            y -= 1;
            m += 12;
        }

        let a = Math.floor(y / 100);
        let b = 2 - a + Math.floor(a / 4);
        if (y < 1583) b = 0;
        if (y === 1582) {
            if (m > 10) b = -10;
            if (m === 10) {
                b = 0;
                if (day > 4) b = -10;
            }
        }

        let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;

        b = 0;
        if (jd > 2299160) {
            a = Math.floor((jd - 1867216.25) / 36524.25);
            b = 1 + a - Math.floor(a / 4);
        }
        let bb = jd + b + 1524;
        let cc = Math.floor((bb - 122.1) / 365.25);
        let dd = Math.floor(365.25 * cc);
        let ee = Math.floor((bb - dd) / 30.6001);
        day = (bb - dd) - Math.floor(30.6001 * ee);
        month = ee - 1;
        if (ee > 13) {
            cc += 1;
            month = ee - 13;
        }
        year = cc - 4716;

        let iyear = 10631.0 / 30.0;
        let epochastro = 1948084;
        let shift1 = 8.01 / 60.0;

        let z = jd - epochastro;
        let cyc = Math.floor(z / 10631);
        z = z - 10631 * cyc;
        let j = Math.floor((z - shift1) / iyear);
        let iy = 30 * cyc + j;
        z = z - Math.floor(j * iyear + shift1);
        let im = Math.floor((z + 28.5001) / 29.5);
        if (im === 13) im = 12;
        let id = Math.floor(z - Math.floor(29.5001 * im - 29));

        let hijriYear = iy + 1;
        let hijriMonth = Math.max(1, Math.min(12, im));
        let hijriDay = Math.max(1, Math.min(30, id));

        const monthName = HIJRI_MONTHS[hijriMonth - 1] || 'Jumadil Akhir';

        return {
            day: hijriDay,
            month: hijriMonth,
            monthName: monthName,
            year: hijriYear,
            formatted: `${hijriDay} ${monthName} ${hijriYear} H`
        };
    }

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

            cacheHijri(result, `${yyyy}-${mm}-${dd}`);
            return result;
        } catch (error) {
            console.warn('[HijriDate] API fetch notice:', error.message);
            return null;
        }
    }

    function getHijriFromIntl(date) {
        const d = date || new Date();
        if (_hijriAdjustment !== 0) {
            const adjusted = new Date(d);
            adjusted.setDate(adjusted.getDate() + _hijriAdjustment);
            d.setTime(adjusted.getTime());
        }

        try {
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
        } catch (e) {}

        return null;
    }

    async function getHijriDate(date) {
        const d = date || new Date();
        const dateStr = d.toISOString().split('T')[0];

        // 1. Try cached first
        const cached = getCachedHijri(dateStr);
        if (cached) return cached;

        // 2. Try Intl API
        const intlResult = getHijriFromIntl(d);
        if (intlResult) {
            cacheHijri(intlResult, dateStr);
        }

        // 3. Fallback to instant mathematical calculation (0 ms, guaranteed)
        const offlineResult = calculateHijriOffline(d);

        // 4. Fetch official API in background to update cache & event
        fetchHijriFromAPI(d).then(apiResult => {
            if (apiResult) {
                cacheHijri(apiResult, dateStr);
                window.dispatchEvent(new CustomEvent('masjid-hijri-updated', { detail: apiResult }));
            }
        }).catch(() => {});

        return intlResult || offlineResult;
    }

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
        calculateHijriOffline,
        setAdjustment,
        HIJRI_MONTHS,
        MASEHI_DAYS,
        MASEHI_MONTHS
    };
})();

window.HijriDateService = HijriDateService;
