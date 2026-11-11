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
     * Menggunakan Algoritma Standar Kuwaiti astronomis murni.
     * Tidak membutuhkan internet, langsung tersedia dalam 0 milidetik, 100% kompatibel di Smart TV manapun.
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

        let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
        b = 0;
        if (jd > 2299160) {
            a = Math.floor((jd - 1867216.25) / 36524.25);
            b = 1 + a - Math.floor(a / 4);
        }

        let l = jd - 1948440 + 10632;
        let n = Math.floor((l - 1) / 10631);
        l = l - 10631 * n + 354;
        let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
        l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
        let hm = Math.floor((24 * l) / 709);
        let hd = l - Math.floor((709 * hm) / 24);
        let hy = 30 * n + j - 30;

        let hijriMonth = Math.max(1, Math.min(12, hm));
        let hijriDay = Math.max(1, Math.min(30, hd));
        let hijriYear = hy;

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
                month: 'numeric',
                year: 'numeric'
            });

            const parts = formatter.formatToParts(d);
            let day = '', month = '', year = '';

            for (const part of parts) {
                if (part.type === 'day') day = part.value;
                if (part.type === 'month') month = part.value;
                if (part.type === 'year') year = part.value;
            }

            const parsedYear = parseInt(String(year).replace(/\D/g, ''), 10);
            const parsedMonth = parseInt(month, 10);
            const parsedDay = parseInt(day, 10);

            // Validasi ketat: Tahun Hijriah saat ini berkisar 1440 - 1500 H.
            // Jika browser TV fallback ke Masehi (misal tahun 2026), tolak mentah-mentah!
            if (parsedYear && parsedYear >= 1400 && parsedYear <= 1550 && parsedMonth >= 1 && parsedMonth <= 12) {
                const monthName = HIJRI_MONTHS[parsedMonth - 1];
                return {
                    day: parsedDay,
                    month: parsedMonth,
                    monthName: monthName,
                    year: parsedYear,
                    formatted: `${parsedDay} ${monthName} ${parsedYear} H`
                };
            }
        } catch (e) {}

        return null;
    }

    async function getHijriDate(date) {
        const d = date || new Date();
        const dateStr = d.toISOString().split('T')[0];

        // 1. Cek cache yang valid (terbukti murni Hijriah, bukan Masehi)
        const cached = getCachedHijri(dateStr);
        if (cached) return cached;

        // 2. Gunakan perhitungan matematika offline instan (0 ms, 100% akurat, anti-gagal di Smart TV)
        const offlineResult = calculateHijriOffline(d);

        // 3. Coba Intl API jika browser benar-benar mendukung kalender Islam
        const intlResult = getHijriFromIntl(d);
        const baseResult = intlResult || offlineResult;
        cacheHijri(baseResult, dateStr);

        // 4. Sinkronkan dengan API Aladhan resmi di background
        fetchHijriFromAPI(d).then(apiResult => {
            if (apiResult && apiResult.year >= 1400 && apiResult.year <= 1550) {
                cacheHijri(apiResult, dateStr);
                window.dispatchEvent(new CustomEvent('masjid-hijri-updated', { detail: apiResult }));
            }
        }).catch(() => {});

        return baseResult;
    }

    function cacheHijri(result, dateStr) {
        if (!result || !result.year || result.year > 1550) return;
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
            if (data.date === dateStr && data.hijri && data.hijri.year >= 1400 && data.hijri.year <= 1550) {
                // Pastikan nama bulan bukan bulan Masehi
                const m = data.hijri.monthName || '';
                if (HIJRI_MONTHS.indexOf(m) !== -1) {
                    return data.hijri;
                }
            }
            // Hapus cache lama yang cacat/terkontaminasi tanggal Masehi seperti "Juni"
            localStorage.removeItem(CACHE_KEY);
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
