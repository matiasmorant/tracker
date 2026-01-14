function formatDuration(seconds, isTick = false) {
    if (seconds === 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
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

function secondsToDHMS(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return { d, h, m, s };
}

function formatMonth(d) { return d.toLocaleDateString([], { month: 'long', year: 'numeric' }); }
function getFormattedISO(date = new Date()) { return date.toISOString().replace('T', ' ');}

function getRunningTime(s) {
    if (!s.startTime) return '';
    const elapsedMs = Math.max(0, Date.now() - new Date(s.startTime).getTime());
    return formatDuration(Math.floor(elapsedMs / 1000));
}

function prevMonth(date) { return new Date(date.setMonth(date.getMonth()-1)); }
function nextMonth(date) { return new Date(date.setMonth(date.getMonth()+1)); }
