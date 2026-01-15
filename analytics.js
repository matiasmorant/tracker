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
            return e.timestamp.split(' ')[0];
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
        const date = new Date(entry.timestamp);
        let key;

        switch (period) {
            case 'day':
                // Group by date (YYYY-MM-DD)
                key = entry.timestamp.split(' ')[0];
                break;

            case 'week':
                // Group by week start (Monday)
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay()); // Sunday start
                key = weekStart.toISOString().split('T')[0];
                break;

            case 'month':
                // Group by month (YYYY-MM-01)
                key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-01`;
                break;

            case 'quarter':
                // Group by quarter start
                const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3 + 1;
                key = `${date.getFullYear()}-${quarterStartMonth.toString().padStart(2, '0')}-01`;
                break;

            case 'year':
                // Group by year start
                key = `${date.getFullYear()}-01-01`;
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
    let cutoff = new Date();

    switch (range) {
        case 'day': cutoff.setDate(now.getDate() - 1); break;
        case 'week': cutoff.setDate(now.getDate() - 7); break;
        case 'month': cutoff.setMonth(now.getMonth() - 1); break;
        case 'quarter': cutoff.setMonth(now.getMonth() - 3); break;
        case 'year': cutoff.setFullYear(now.getFullYear() - 1); break;
        case 'custom': cutoff.setDate(now.getDate() - customDays); break;
        default: return entries;
    }

    return entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= cutoff;
    });
}

export function calculateSeriesSummary(series, entries, formatDuration) {
    if (!series || !series.config || !entries || entries.length === 0) {
        return null;
    }

    const config = series.config;
    let filteredEntries = [...entries];

    // Filter by period if not 'all'
    if (config.period !== 'all') {
        const now = new Date();
        const startOfPeriod = new Date();
        startOfPeriod.setHours(0, 0, 0, 0);

        switch (config.period) {
            case 'day':
                // Already at start of day
                break;
            case 'week':
                startOfPeriod.setDate(now.getDate() - now.getDay());
                break;
            case 'month':
                startOfPeriod.setDate(1);
                break;
            case 'quarter':
                const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
                startOfPeriod.setMonth(quarterMonth, 1);
                break;
            case 'year':
                startOfPeriod.setMonth(0, 1);
                break;
        }

        filteredEntries = filteredEntries.filter(e => new Date(e.timestamp) >= startOfPeriod);
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