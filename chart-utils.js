export function parseDate(dateValue) {
  if (typeof dateValue === 'number') return dateValue;
  if (typeof dateValue === 'string') {
    const parsed = Date.parse(dateValue);
    if (!isNaN(parsed)) return parsed;
  }
  if (dateValue instanceof Date) return dateValue.getTime();
  return Date.now();
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
  if (!(date instanceof Date)) date = new Date(date);
  
  const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
  const isFirstOfMonth = date.getDate() === 1;
  
  if (dateRangeDays <= 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else if (dateRangeDays <= 30) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else if (dateRangeDays <= 90) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else if (dateRangeDays <= 365) {
    if (isFirstOfMonth) {
      return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short' });
    }
  } else {
    return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
  }
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

export function generateXLabels(points, count = 8, viewDays = 0, panOffset = 0) {
  if (points.length === 0) return Array(count).fill('');
  
  const dates = points.map(p => parseDate(p.x));
  let minDate = Math.min(...dates);
  let maxDate = Math.max(...dates);
  
  if (viewDays > 0 && panOffset) {
    const visibleRangeMs = viewDays * 24 * 60 * 60 * 1000;
    const panOffsetMs = panOffset * 24 * 60 * 60 * 1000;
    maxDate = Math.max(...dates) - panOffsetMs;
    minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
  } else if (viewDays > 0) {
    maxDate = Math.max(...dates);
    minDate = maxDate - (viewDays * 24 * 60 * 60 * 1000);
  }
  
  const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
  
  if (dateRangeDays > 90 && dateRangeDays <= 365) {
    return generateMonthlyTicks(minDate, maxDate);
  }
  
  const labels = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(minDate + (i / (count - 1)) * (maxDate - minDate));
    labels.push(formatDate(date, minDate, maxDate));
  }
  
  return labels;
}

export function getMonthIndex(timestamp) {
  const date = new Date(timestamp);
  return date.getMonth() + (date.getFullYear() * 12);
}

export function generateMonthlyTicks(startDateMs, endDateMs) {
  const startDate = new Date(startDateMs);
  const endDate = new Date(endDateMs);
  const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  const monthlyDates = [];
  let currentDate = new Date(firstDate);
  
  while (currentDate <= endDate) {
    monthlyDates.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }
  
  const filteredDates = monthlyDates.filter(date => {
    const dateMs = date.getTime();
    return dateMs >= startDateMs - (30 * 24 * 60 * 60 * 1000) && 
           dateMs <= endDateMs + (30 * 24 * 60 * 60 * 1000);
  });
  
  return filteredDates.map(date => formatDate(date, startDateMs, endDateMs));
}

export function generateMonthlyTickDates(minDate, maxDate) {
  const startDate = new Date(minDate);
  const endDate = new Date(maxDate);
  const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  let tickDates = [];
  let currentDate = new Date(firstDate);
  
  while (currentDate <= endDate) {
    tickDates.push(currentDate.getTime());
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }
  
  return tickDates;
}

export function getTotalDataDays(chartData) {
  if (!chartData?.datasets?.length) return 0;
  
  const allPoints = chartData.datasets.flatMap(dataset => 
    dataset.data?.filter(p => p.x) || []
  );
  
  if (allPoints.length === 0) return 0;
  
  const dates = allPoints.map(p => parseDate(p.x));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  
  return (maxDate - minDate) / (24 * 60 * 60 * 1000);
}

export function createXScale(points, chartWidth, viewDays = 0, panOffset = 0) {
  const xValues = points.map(p => parseDate(p.x));
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  
  let visibleMinX = minX;
  let visibleMaxX = maxX;
  
  if (viewDays > 0) {
    const visibleRangeMs = viewDays * 24 * 60 * 60 * 1000;
    const panOffsetMs = panOffset * 24 * 60 * 60 * 1000;
    
    visibleMaxX = maxX - panOffsetMs;
    visibleMinX = Math.max(minX, visibleMaxX - visibleRangeMs);
    
    if (visibleMinX < minX) {
      visibleMinX = minX;
      visibleMaxX = Math.min(maxX, visibleMinX + visibleRangeMs);
    }
  }
  
  const dateRangeDays = (visibleMaxX - visibleMinX) / (24 * 60 * 60 * 1000);
  let tickDates = [];
  
  if (dateRangeDays > 90 && dateRangeDays <= 365) {
    tickDates = generateMonthlyTickDates(visibleMinX, visibleMaxX);
  }
  
  return (date) => {
    let x = parseDate(date);
    
    if (tickDates.length > 0) {
      const tolerance = 2 * 24 * 60 * 60 * 1000;
      const matchingTick = tickDates.find(tick => Math.abs(tick - x) < tolerance);
      if (matchingTick) x = matchingTick;
    }
    
    return ((x - visibleMinX) / (visibleMaxX - visibleMinX)) * chartWidth;
  };
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

export function getVisibleDateRange(points, viewDays = 0, panOffset = 0) {
  const dates = points.map(p => parseDate(p.x));
  let minDate = Math.min(...dates);
  let maxDate = Math.max(...dates);
  
  if (viewDays > 0 && panOffset) {
    const visibleRangeMs = viewDays * 24 * 60 * 60 * 1000;
    const panOffsetMs = panOffset * 24 * 60 * 60 * 1000;
    maxDate = Math.max(...dates) - panOffsetMs;
    minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
  } else if (viewDays > 0) {
    maxDate = Math.max(...dates);
    minDate = maxDate - (viewDays * 24 * 60 * 60 * 1000);
  }
  
  return { minDate, maxDate };
}

export function generateSmoothPath(points, xScale, yScale, paddingLeft, paddingTop, tension = 0.2) {
  if (points.length < 2) return '';
  
  let pathData = `M ${paddingLeft + xScale(points[0].x)} ${paddingTop + yScale(points[0].y)}`;
  
  if (tension > 0 && points.length > 2) {
    for (let i = 1; i < points.length; i++) {
      const x0 = paddingLeft + xScale(points[Math.max(0, i - 2)].x);
      const y0 = paddingTop + yScale(points[Math.max(0, i - 2)].y);
      const x1 = paddingLeft + xScale(points[i - 1].x);
      const y1 = paddingTop + yScale(points[i - 1].y);
      const x2 = paddingLeft + xScale(points[i].x);
      const y2 = paddingTop + yScale(points[i].y);
      const x3 = paddingLeft + xScale(points[Math.min(points.length - 1, i + 1)].x);
      const y3 = paddingTop + yScale(points[Math.min(points.length - 1, i + 1)].y);
      
      const cp1x = x1 + (x2 - x0) / 6 * tension;
      const cp1y = y1 + (y2 - y0) / 6 * tension;
      const cp2x = x2 - (x3 - x1) / 6 * tension;
      const cp2y = y2 - (y3 - y1) / 6 * tension;
      
      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }
  } else {
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${paddingLeft + xScale(points[i].x)} ${paddingTop + yScale(points[i].y)}`;
    }
  }
  
  return pathData;
}

export default {
  parseDate,
  formatValue,
  formatDate,
  getMonthIndex,
  generateYValues,
  generateXLabels,
  generateMonthlyTicks,
  generateMonthlyTickDates,
  getTotalDataDays,
  createXScale,
  createYScale,
  getVisibleDateRange,
  generateSmoothPath
};