import {format,subDays,subMonths,subYears,startOfDay,startOfWeek,startOfMonth,startOfYear,isWithinInterval,parseISO,differenceInDays } from 'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm';
import { formatDuration } from './utils.js';

export function calculateStats(sortedValues, originalOrder = [], entries = []) {
    if (!sortedValues || sortedValues.length === 0) {
        return {
            mean: 0, dayMean: 0, sum: 0, count: 0, min: 0,
            q1: 0, median: 0, q3: 0, max: 0,
            first: 0, last: 0
        };
    }

    const sum = sortedValues.reduce((a, b) => a + b, 0);
    const count = sortedValues.length;
    const mean = sum / count;

    // Calculate day mean (average per unique day)
    let dayMean = 0;
    if (entries.length > 0) {
        const uniqueDays = new Set(entries.map(e => {
            if (!e.timestamp) return '';
            return format(parseISO(e.timestamp), 'yyyy-MM-dd');
        })).size;
        dayMean = uniqueDays > 0 ? sum / uniqueDays : 0;
    }

    // Calculate percentiles (Q1, median, Q3)
    const getQuantile = (quantile) => {
        const position = (sortedValues.length - 1) * quantile;
        const base = Math.floor(position);
        const remainder = position - base;

        if (sortedValues[base + 1] !== undefined) {
            return sortedValues[base] + remainder * (sortedValues[base + 1] - sortedValues[base]);
        }
        return sortedValues[base];
    };

    const q1 = getQuantile(0.25);
    const median = getQuantile(0.5);
    const q3 = getQuantile(0.75);

    // Get first and last values from original order
    const first = originalOrder.length > 0 ? originalOrder[0] : sortedValues[0];
    const last = originalOrder.length > 0 ? originalOrder[originalOrder.length - 1] : sortedValues[sortedValues.length - 1];

    return {
        mean,
        dayMean,
        sum,
        count,
        min: sortedValues[0],
        q1,
        median,
        q3,
        max: sortedValues[sortedValues.length - 1],
        first,
        last
    };
}

export function getPeriodData(entries, period) {
    if (period === 'none' || !entries || entries.length === 0) {
        return {
            labels: [],
            datasets: {}
        };
    }

    const groups = {};

    entries.forEach(entry => {
        const date = parseISO(entry.timestamp);
        let key;

        switch (period) {
            case 'day':
                // Group by date (YYYY-MM-DD)
                key = format(date, 'yyyy-MM-dd');
                break;

            case 'week':
                // Group by week start (Monday)
                const weekStart = startOfWeek(date, { weekStartsOn: 0 });
                key = format(weekStart, 'yyyy-MM-dd');
                break;

            case 'month':
                // Group by month (YYYY-MM-01)
                const monthStart = startOfMonth(date);
                key = format(monthStart, 'yyyy-MM-dd');
                break;

            case 'quarter':
                // Group by quarter start
                const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
                const quarterStart = new Date(date.getFullYear(), quarterStartMonth, 1);
                key = format(quarterStart, 'yyyy-MM-dd');
                break;

            case 'year':
                // Group by year start
                const yearStart = startOfYear(date);
                key = format(yearStart, 'yyyy-MM-dd');
                break;

            default:
                return;
        }

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(entry);
    });

    // Sort keys chronologically
    const sortedKeys = Object.keys(groups).sort();

    // Initialize result structure
    const result = {
        labels: sortedKeys,
        datasets: {}
    };

    // Calculate stats for each group
    sortedKeys.forEach(key => {
        const groupEntries = groups[key];
        const rawValues = groupEntries.map(e => e.value);
        const sortedValues = [...rawValues].sort((a, b) => a - b);
        const stats = calculateStats(sortedValues, rawValues, groupEntries);

        // Add each stat to datasets
        Object.keys(stats).forEach(statKey => {
            if (!result.datasets[statKey]) {
                result.datasets[statKey] = [];
            }
            result.datasets[statKey].push(stats[statKey]);
        });
    });

    return result;
}

export function calculateRunningMetric(values, labels, metric, windowSize) {
    if (!values || !labels || values.length === 0 || windowSize < 2 || values.length < windowSize) {
        return [];
    }

    const result = [];

    for (let i = 0; i <= values.length - windowSize; i++) {
        const windowValues = values.slice(i, i + windowSize);
        const sortedWindowValues = [...windowValues].sort((a, b) => a - b);
        const stats = calculateStats(sortedWindowValues, windowValues);

        // Get the middle index for the timestamp
        const midIdx = Math.floor(i + (windowSize - 1) / 2);

        if (stats[metric] !== undefined && labels[midIdx]) {
            result.push({
                x: labels[midIdx],
                y: stats[metric]
            });
        }
    }

    return result;
}

export function filterByRange(entries, range = 'all', customDays = 30) {
    if (range === 'all' || !entries || entries.length === 0) {
        return entries;
    }

    const now = new Date();
    let cutoffDate;

    switch (range) {
        case 'day': cutoffDate = subDays(now, 1); break;
        case 'week': cutoffDate = subDays(now, 7); break;
        case 'month': cutoffDate = subMonths(now, 1); break;
        case 'quarter': cutoffDate = subMonths(now, 3); break;
        case 'year': cutoffDate = subYears(now, 1); break;
        case 'custom': cutoffDate = subDays(now, customDays); break;
        default: return entries;
    }

    return entries.filter(entry => {
        const entryDate = parseISO(entry.timestamp);
        return entryDate >= cutoffDate;
    });
}

export function calculateSeriesSummary(series, entries, formatDuration, summaryConfig = null) {
    if (!series || !entries || entries.length === 0) {
        return null;
    }

    // Handle multiple summaries (new format)
    if (summaryConfig) {
        return calculateSingleSummary(series, entries, formatDuration, summaryConfig);
    }

    // Handle legacy single summary format
    if (series.config) {
        return calculateLegacySummary(series, entries, formatDuration);
    }

    return null;
}

function calculateSingleSummary(series, entries, formatDuration, summaryConfig) {
    const { period = 'all', operation = 'mean', customDays = 30 } = summaryConfig;
    let filteredEntries = filterEntriesByPeriod(entries, period, customDays);

    if (filteredEntries.length === 0) {
        return null;
    }

    // Calculate the requested operation
    const values = filteredEntries.map(e => e.value).sort((a, b) => a - b);
    const stats = calculateStats(values, filteredEntries.map(e => e.value), filteredEntries);
    
    let statValue = 0;
    
    // Special handling for certain operations
    if (operation === 'dayMean' && filteredEntries.length > 0) {
        // Calculate unique days
        const uniqueDays = new Set(filteredEntries.map(e => {
            if (!e.timestamp) return '';
            const date = parseISO(e.timestamp);
            return format(date, 'yyyy-MM-dd');
        })).size;
        const sum = stats.sum || 0;
        statValue = uniqueDays > 0 ? sum / uniqueDays : 0;
    } else {
        statValue = stats[operation] || 0;
    }

    // Format based on series type
    let formattedValue;
    if (series.type === 'time') {
        formattedValue = formatDuration ? formatDuration(statValue) : `${statValue}s`;
    } else {
        formattedValue = statValue.toLocaleString(undefined, { 
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        });
    }

    // Map operation IDs to display names
    const operationLabels = {
        mean: 'Avg',
        dayMean: 'Daily Avg',
        sum: 'Total',
        count: 'Count',
        min: 'Min',
        q1: 'Q1',
        median: 'Median',
        q3: 'Q3',
        max: 'Max',
        first: 'First',
        last: 'Last'
    };

    // Map period to display label
    const periodLabels = {
        all: 'All',
        today: 'Today',
        week: 'Week',
        month: 'Month',
        quarter: 'Quarter',
        year: 'Year',
        custom: `${customDays}d`
    };

    const operationLabel = operationLabels[operation] || operation;
    const periodLabel = periodLabels[period] || period;
    
    return `${operationLabel}: ${formattedValue}`;
}

function calculateLegacySummary(series, entries, formatDuration) {
    const config = series.config;
    if (!config) return null;
    
    let filteredEntries = [...entries];

    // Filter by period if not 'all'
    if (config.period !== 'all') {
        const now = new Date();
        let startOfPeriod;

        switch (config.period) {
            case 'day':
                startOfPeriod = startOfDay(now);
                break;
            case 'week':
                startOfPeriod = startOfWeek(now, { weekStartsOn: 0 });
                break;
            case 'month':
                startOfPeriod = startOfMonth(now);
                break;
            case 'quarter':
                const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
                startOfPeriod = new Date(now.getFullYear(), quarterMonth, 1);
                break;
            case 'year':
                startOfPeriod = startOfYear(now);
                break;
            default:
                startOfPeriod = startOfDay(now);
        }

        filteredEntries = filteredEntries.filter(e => {
            const entryDate = parseISO(e.timestamp);
            return entryDate >= startOfPeriod;
        });
    }

    if (filteredEntries.length === 0) {
        return null;
    }

    // Calculate the requested statistic
    const values = filteredEntries.map(e => e.value).sort((a, b) => a - b);
    const stats = calculateStats(values, filteredEntries.map(e => e.value), filteredEntries);
    
    const statValue = stats[config.stat] || 0;
    
    // Format based on series type
    let formattedValue;
    if (series.type === 'time') {
        formattedValue = formatDuration ? formatDuration(statValue) : `${statValue}s`;
    } else {
        formattedValue = statValue.toLocaleString(undefined, { 
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        });
    }

    // Map stat IDs to display names
    const statLabels = {
        mean: 'Mean',
        dayMean: 'Day Mean',
        sum: 'Sum',
        count: 'Count',
        min: 'Min',
        q1: 'Q1',
        median: 'Median',
        q3: 'Q3',
        max: 'Max',
        first: 'First',
        last: 'Last'
    };

    const label = statLabels[config.stat] || 'Value';
    return `${label}: ${formattedValue}`;
}

function filterEntriesByPeriod(entries, period, customDays = 30) {
    if (period === 'all' || !entries || entries.length === 0) {
        return entries;
    }

    const now = new Date();
    let cutoff;

    switch (period) {
        case 'today':
            cutoff = startOfDay(now);
            break;
        case 'week':
            cutoff = startOfWeek(now, { weekStartsOn: 0 });
            break;
        case 'month':
            cutoff = startOfMonth(now);
            break;
        case 'quarter':
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            cutoff = new Date(now.getFullYear(), quarterMonth, 1);
            break;
        case 'year':
            cutoff = startOfYear(now);
            break;
        case 'custom':
            cutoff = subDays(now, customDays);
            break;
        default:
            return entries;
    }

    return entries.filter(entry => {
        const entryDate = parseISO(entry.timestamp);
        return entryDate >= cutoff;
    });
}