import { 
  format, 
  startOfMonth,
  startOfYear,
  startOfDay,
  addDays,
  subDays,
  addMonths,
  addYears,
  differenceInDays,
  min as dateFnsMin,
  max as dateFnsMax,
} from 'date-fns';

// Returns a Date object. Single conversion point from raw data.
export function parseDate(dateValue) {
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'number') return new Date(dateValue);
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed)) return parsed;
  }
  return new Date();
}

export function getXMode(days) {
  const [low, high]        = [1.1,  10];
  const [day, month, year] = [1, 365/12, 365];

  if (days > year  * high) return 'tick-year';
  if (days > year  * low ) return 'shade-year';
  if (days > month * high) return 'tick-month';
  if (days > month * low ) return 'shade-month';
  if (days > day   * high) return 'tick-day';
  if (days > day   * low ) return 'shade-day';
  return 'hour';
}

export function getUnitFns(unit) {
  if (unit === 'year')  return { startOf: startOfYear,  addFn: addYears };
  if (unit === 'month') return { startOf: startOfMonth, addFn: addMonths };
  return                       { startOf: startOfDay,   addFn: addDays };
}

export function generateTickDates(unit, minDate, maxDate, step = 1) {
  const { startOf, addFn } = getUnitFns(unit);
  const dates = [];
  for (let cur = startOf(minDate); cur <= maxDate; cur = addFn(cur, step)) {
    dates.push(cur);
  }
  return dates;
}

export function formatXLabel(date, mode) {
  if (mode === 'shade-year' || mode === 'tick-year')   return format(date, 'yyyy');
  if (mode === 'shade-month' || mode === 'tick-month') return format(date, 'MMM');
  if (mode === 'shade-day' || mode === 'tick-day')     return format(date, 'd MMM');
  return format(date, 'HH:mm'); // hour
}

export function dateRange(count, [minDate, maxDate]) {
  const totalMs = maxDate - minDate;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(new Date(minDate.getTime() + (i / (count - 1)) * totalMs));
  }
  return result;
}

export function getPointsDateRange(points) {
  if (!points || points.length === 0) return [new Date(), new Date()];
  const dates = points.map(p => parseDate(p.x));
  return [dateFnsMin(dates), dateFnsMax(dates)];
}

export function getPeriodBands(unit, [minDate, maxDate], globalMin) {
  const { startOf, addFn } = getUnitFns(unit);
  const getIndex = unit === 'year'  ? (d) => d.getFullYear() : 
                   unit === 'month' ? (d) => (d.getMonth() + (d.getFullYear() * 12)) : 
                   (d) => Math.floor(d.getTime() / (24 * 60 * 60 * 1000));
  
  const firstIndex = getIndex(startOf(globalMin));
  const bands      = [];
  
  for (let cur = startOf(minDate); cur <= maxDate; cur = addFn(cur, 1)) {
    const start = cur;
    const end   = addFn(start, 1);
    bands.push({
      start, end,
      isEven: (getIndex(start) - firstIndex) % 2 === 0
    });
  }
  return bands;
}

export function getXAxisConfig(points, viewDays, panOffset) {
  const [minDate, maxDate] = getVisibleDateRange(points, viewDays, panOffset);
  const [globalMin]        = getPointsDateRange(points);
  const mode               = getXMode(differenceInDays(maxDate, minDate));
  
  let items = [];
  if (mode.startsWith('shade-')) {
    items = getPeriodBands(mode.split('-')[1], [minDate, maxDate], globalMin)
      .map(b => {
        b.start = dateFnsMax([b.start , minDate]);
        b.end   = dateFnsMin([b.end   , maxDate]);
        const label = {
          pos: new Date(b.start.getTime() + (b.end.getTime() - b.start.getTime()) / 2),
          text: formatXLabel(b.start, mode)
        };
        return { ...b, type: 'shade', label };
      });
  } else if (mode.startsWith('tick-')) {
    items = generateTickDates(mode.split('-')[1], minDate, maxDate, 3)
      .map(date => ({ date, type: 'tick', label: { pos: date, text: formatXLabel(date, mode) } }));
  } else {
    items = dateRange(8, [minDate, maxDate])
      .map(date => ({ date, type: 'tick', label: { pos: date, text: formatXLabel(date, mode) } }));
  }
  
  return { minDate, maxDate, mode, items };
}

export function formatValue(value, customFormatter = null) {
  if (customFormatter) return customFormatter(value);
  
  const roundedValue = Math.round(value * 1e10) / 1e10;
  
  if (Math.abs(roundedValue) >= 1000000) {
    return (roundedValue / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
  }
  if (Math.abs(roundedValue) >= 1000) {
    return (roundedValue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
  }
  
  return roundedValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatDate(date, minDate, maxDate) {
  date = parseDate(date);
  const dRange = differenceInDays(maxDate, minDate);
  const mode   = getXMode(dRange);
  return formatXLabel(date, mode);
}

export function generateYValues(values, count = 6, logScale = false) {
  if (values.length === 0) return Array(count).fill(0);
  
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  
  if (minVal === maxVal) {
    minVal = minVal > 0 ? minVal * 0.9 : minVal - 1;
    maxVal = maxVal > 0 ? maxVal * 1.1 : maxVal + 1;
  }

  if (logScale && minVal > 0) {
    const logMin = Math.floor(Math.log10(minVal));
    const logMax = Math.log10(maxVal);
    
    let ticks = [];
    const multiples = [1, 2, 5, 10];
    
    for (let d = logMin; d < Math.ceil(logMax); d++) {
      multiples.forEach(m => {
        const val = Math.pow(10, d) * m;
        const prevMultipleValue = ticks.length > 0 ? ticks[ticks.length - 1] : 0;
        
        if (val >= Math.pow(10, logMin) && prevMultipleValue < maxVal) {
          ticks.push(val);
        }
      });
    }

    return [...new Set(ticks)].sort((a, b) => a - b);
  }

  const rawStep = (maxVal - minVal) / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const res = rawStep / magnitude;
  
  let niceStep;
  if (res < 1.5) niceStep = 1;
  else if (res < 3) niceStep = 2;
  else if (res < 7) niceStep = 5;
  else niceStep = 10;
  niceStep *= magnitude;

  const graphMin = Math.floor(minVal / niceStep) * niceStep;
  const graphMax = Math.ceil(maxVal / niceStep) * niceStep;

  const result = [];
  for (let v = graphMin; v <= graphMax + niceStep * 0.0001; v += niceStep) {
    result.push(v);
  }
  
  return result;
}

// Returns Date[]
export function getVisibleDateRange(points, viewDays = 0, panOffset = 0) {
  const [minDate, maxDate] = getPointsDateRange(points);
  
  if (viewDays <= 0) return [minDate, maxDate];

  let vMax = subDays(maxDate, panOffset);
  let vMin = dateFnsMax([minDate, subDays(vMax, viewDays)]);
  
  if (vMin <= minDate) {
    vMin = minDate;
    vMax = dateFnsMin([maxDate, addDays(vMin, viewDays)]);
  }
  
  return [vMin, vMax];
}



export function getTotalDataDays(chartData) {
  if (!chartData?.datasets?.length) return 0;
  
  const allPoints = chartData.datasets.flatMap(dataset => 
    dataset.data?.filter(p => p.x) || []
  );
  
  const [minDate, maxDate] = getPointsDateRange(allPoints);
  return differenceInDays(maxDate, minDate);
}

export function createXScale(points, chartWidth, viewDays = 0, panOffset = 0) {
  const [minDate, maxDate] = getVisibleDateRange(points, viewDays, panOffset);
  const visibleMinMs = minDate.getTime();
  const visibleRangeMs = Math.max(1, maxDate.getTime() - visibleMinMs);

  return (date) => ((parseDate(date).getTime() - visibleMinMs) / visibleRangeMs) * chartWidth;
}

export function createYScale(points, chartHeight, logScale = false) {
  const yValues = points.map(p => p.y);
  const displayYValues = generateYValues(yValues, 6, logScale);
  let minY = Math.min(...displayYValues);
  let maxY = Math.max(...displayYValues);
  
  if (minY === maxY) return (y) => chartHeight / 2;
  
  if (logScale && minY > 0) {
    minY = Math.log10(minY);
    maxY = Math.log10(maxY);
    return (y) => {
      if (y <= 0) return chartHeight;
      const logY = Math.log10(y);
      return chartHeight - ((logY - minY) / (maxY - minY)) * chartHeight;
    };
  }
  
  return (y) => chartHeight - ((y - minY) / (maxY - minY)) * chartHeight;
}

export function generateSmoothPath(points, xScale, yScale, paddingLeft, paddingTop, tension = 0.2) {
  if (points.length < 2) return '';
  
  const getX = (p) => paddingLeft + xScale(p.x);
  const getY = (p) => paddingTop  + yScale(p.y);

  let pathData = `M ${getX(points[0])} ${getY(points[0])}`;
  
  if (tension > 0 && points.length > 2) {
    for (let i = 1; i < points.length; i++) {
      const p0 = points[Math.max(0, i - 2)];
      const p1 = points[i - 1];
      const p2 = points[i];
      const p3 = points[Math.min(points.length - 1, i + 1)];
      
      const x0 = getX(p0), y0 = getY(p0);
      const x1 = getX(p1), y1 = getY(p1);
      const x2 = getX(p2), y2 = getY(p2);
      const x3 = getX(p3), y3 = getY(p3);
      
      const cp1x = x1 + (x2 - x0) / 6 * tension;
      const cp1y = y1 + (y2 - y0) / 6 * tension;
      const cp2x = x2 - (x3 - x1) / 6 * tension;
      const cp2y = y2 - (y3 - y1) / 6 * tension;
      
      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }
  } else {
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${getX(points[i])} ${getY(points[i])}`;
    }
  }
  
  return pathData;
}
