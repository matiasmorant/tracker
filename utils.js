import { format, subMonths, addMonths, differenceInSeconds, intervalToDuration } from 'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm';

export function formatDuration(seconds, isTick = false) {
    if (seconds === 0) return '0s';

    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });    
    const { days: d, hours: h, minutes: m, seconds: s } = duration;

    if (isTick) {
        if (d > 0) return `${d}d`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m}m`;
        return `${s}s`;
    }

    let res = [];
    if (d > 0) res.push(`${d}d`);
    if (h > 0) res.push(`${h}h`);
    if (m > 0) res.push(`${m}m`);
    if (s > 0 || res.length === 0) res.push(`${s}s`);
    
    return res.join(' ');
}

export function secondsToDHMS(seconds) {
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    return {
        d: duration.days || 0,
        h: duration.hours || 0,
        m: duration.minutes || 0,
        s: duration.seconds || 0
    };
}

export function formatMonth(d) { return format(d, 'MMMM yyyy'); }
export function getFormattedISO(d = new Date()) { return format(d, 'yyyy-MM-dd HH:mm:ss'); }

export function elapsedSeconds(s) {
    if (!s.startTime) return 0;
    const elapsedSeconds = differenceInSeconds(new Date(), new Date(s.startTime));
    return Math.max(0, elapsedSeconds);
}
export function getRunningTime(s) { return formatDuration(elapsedSeconds(s)); }

export function prevMonth(date) { return subMonths(date, 1);}
export function nextMonth(date) { return addMonths(date, 1);}
