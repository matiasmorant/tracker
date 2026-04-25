import { subDays,subMonths,subYears,startOfDay,startOfWeek,startOfMonth,startOfQuarter,startOfYear,isWithinInterval,parseISO,differenceInDays } from 'date-fns';
import { format } from './utils.js';

function periodKey(period, date) {
    if (period === 'day'     ) { return startOfDay     (date); }
    if (period === 'week'    ) { return startOfWeek    (date, { weekStartsOn: 0 }); }
    if (period === 'month'   ) { return startOfMonth   (date); }
    if (period === 'quarter' ) { return startOfQuarter (date); }
    if (period === 'year'    ) { return startOfYear    (date); }
    if (period === 'today'   ) { return startOfDay     (date); }
    return null;
}

const STAT_LABELS = {
    mean    : 'Avg',
    dayMean : 'Daily Avg',
    sum     : 'Total',
    count   : 'Count',
    min     : 'Min',
    q1      : 'Q1',
    median  : 'Median',
    q3      : 'Q3',
    max     : 'Max',
    first   : 'First',
    last    : 'Last'
};

function getQuantile(sortedValues, quantile) {
    const position  = (sortedValues.length - 1) * quantile;
    const base      = Math.floor(position);
    const remainder = position - base;

    if (sortedValues[base + 1] !== undefined) {
        return sortedValues[base] + remainder * (sortedValues[base + 1] - sortedValues[base]);
    }
    return sortedValues[base];
}

export function calculateStat(entries, stat, period = 'none') {
    if (_.isEmpty(entries)) return 0;
    if (period !== 'none') {
        return _(entries)
            .groupBy(e => {
                const date = parseISO(e.timestamp);
                const key  = periodKey(period, date);
                return key && format.day(key);
            })
            .map((g, timestamp) => ({
                timestamp,
                value: calculateStat(g, stat)
            }))
            .sortBy('timestamp')
            .value();
    }

    const values = _.map(entries, 'value');

    switch (stat) {
        case 'mean':    return _.mean(values);
        case 'dayMean': {
            const uniqueDays = _(entries)
                .map(e => e.timestamp ? format.day(parseISO(e.timestamp)) : '')
                .uniq()
                .size();
            const sum = _.sum(values);
            return uniqueDays > 0 ? sum / uniqueDays : 0;
        }
        case 'sum':     return _.sum(values);
        case 'count':   return values.length;
        case 'min':     return _.min(values);
        case 'q1':      return getQuantile(_.sortBy(values), 0.25);
        case 'median':  return getQuantile(_.sortBy(values), 0.5);
        case 'q3':      return getQuantile(_.sortBy(values), 0.75);
        case 'max':     return _.max(values);
        case 'first':   return _.first(values);
        case 'last':    return _.last(values);
    }
}

export function calculateRunningMetric(entries, metric, windowSize) {
    if (!entries || entries.length === 0 || windowSize < 2 || entries.length < windowSize) {
        return [];
    }

    const result = [];

    for (let i = 0; i <= entries.length - windowSize; i++) {
        const windowEntries = entries.slice(i, i + windowSize);
        const midIdx         = Math.floor(i + (windowSize - 1) / 2);
        const value          = calculateStat(windowEntries, metric);

        if (value !== undefined && entries[midIdx]?.timestamp) {
            result.push({ timestamp: entries[midIdx].timestamp, value });
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
        case 'day'     : cutoffDate = subDays   (now, 1); break;
        case 'week'    : cutoffDate = subDays   (now, 7); break;
        case 'month'   : cutoffDate = subMonths (now, 1); break;
        case 'quarter' : cutoffDate = subMonths (now, 3); break;
        case 'year'    : cutoffDate = subYears  (now, 1); break;
        case 'custom'  : cutoffDate = subDays   (now, customDays); break;
        default: return entries;
    }

    return entries.filter(x => parseISO(x.timestamp) >= cutoffDate);
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

    if (_.isEmpty(filteredEntries)) {
        return null;
    }

    const statValue = calculateStat(filteredEntries, operation);

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

    const operationLabel = STAT_LABELS[operation] || operation;
    return `${operationLabel}: ${formattedValue}`;
}

function calculateLegacySummary(series, entries, formatDuration) {
    const config = series.config;
    if (!config) return null;
    
    let filteredEntries = [...entries];

    // Filter by period if not 'all'
    if (config.period !== 'all') {
        const startOfPeriod = periodKey(config.period, new Date()) ?? startOfDay(new Date());
        filteredEntries = filteredEntries.filter(e => parseISO(e.timestamp) >= startOfPeriod);
    }

    if (_.isEmpty(filteredEntries)) {
        return null;
    }

    const statValue = calculateStat(filteredEntries, config.stat);
    
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

    const label = STAT_LABELS[config.stat] || 'Value';
    return `${label}: ${formattedValue}`;
}

function filterEntriesByPeriod(entries, period, customDays = 30) {
    if (period === 'all' || !entries || entries.length === 0) {
        return entries;
    }

    const now = new Date();
    let cutoff;

    cutoff = period === 'custom' ? subDays(now, customDays) : periodKey(period, now);
    if (!cutoff) return entries;

    return entries.filter(x => parseISO(x.timestamp) >= cutoff);
}