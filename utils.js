import { format as formatFn, differenceInSeconds, intervalToDuration } from 'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm';

function formatDuration(seconds, isTick = false) {
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

export const format = {
    month    : (d) => formatFn(d, 'MMMM yyyy'),
    day      : (d) => formatFn(d, 'yyyy-MM-dd'),
    dateTime : (d) => formatFn(d, 'yyyy-MM-dd HH:mm:ss'),
    duration : formatDuration
};


export function elapsedSeconds(s) {
    if (!s.startTime) return 0;
    const elapsedSeconds = differenceInSeconds(new Date(), new Date(s.startTime));
    return Math.max(0, elapsedSeconds);
}
export function getRunningTime(s) { return format.duration(elapsedSeconds(s)); }


export const toggleModal = (id)=>{document.getElementById(id).toggleAttribute('open'); m.redraw();}

export class Duration {
  constructor(totalSeconds = 0) {
    this.d = 0;
    this.h = 0;
    this.m = 0;
    this.s = 0;
    if (totalSeconds > 0) {
      this.fromTotalSeconds(totalSeconds);
    }
  }

  toTotalSeconds() {
    return (parseInt(this.d) || 0) * 86400 +
           (parseInt(this.h) || 0) * 3600 +
           (parseInt(this.m) || 0) * 60 +
           (parseInt(this.s) || 0);
  }

  fromTotalSeconds(totalSeconds) {
    const secs = parseInt(totalSeconds) || 0;
    this.d = Math.floor(secs / 86400);
    this.h = Math.floor((secs % 86400) / 3600);
    this.m = Math.floor((secs % 3600) / 60);
    this.s = secs % 60;
  }
}

export const withDefaults = (obj, defaults) => _.defaultsDeep(_.pick(obj || {}, _.keys(defaults)), defaults);