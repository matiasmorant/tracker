import {calculateStats,getPeriodData,calculateRunningMetric,filterByRange,calculateSeriesSummary} from './analytics.js';

let chartInstance = null;

export function initChart(chartCanvasId, currentSeries, chartSettings, metrics, formatDuration) {
    const ctx = document.getElementById(chartCanvasId)?.getContext('2d');
    if (!ctx) return null;
    
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { datasets: [] },
        options: getChartOptions(currentSeries, chartSettings, formatDuration)
    });
    
    window.seriesChart = chartInstance;
    return chartInstance;
}

export function getChartOptions(currentSeries, chartSettings, formatDuration) {
    return {
        layout: { padding: { top: 20 } },
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',
                    threshold: 10,
                    modifierKey: null
                },
                zoom: {
                    wheel: { enabled: false },
                    pinch: { enabled: false },
                    drag: { enabled: false },
                    mode: 'x'
                }
            },
            tooltip: { 
                callbacks: { 
                    label: (c) => currentSeries && currentSeries.type === 'time' 
                        ? `Value: ${formatDuration(c.parsed.y)}` 
                        : `Value: ${c.parsed.y}` 
                } 
            }
        },
        scales: { 
            y: {
                type: chartSettings?.logScale ? 'logarithmic' : 'linear',
                ticks: {
                    mirror: true,
                    maxTicksLimit: 8,
                    callback: (v) => {
                        if (currentSeries && currentSeries.type === 'time') return formatDuration(v, true);
                        return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
                    },
                    padding: -2, 
                    z: 1
                },
                grace: '5%'
            },
            x: { 
                type: 'time', 
                time: { 
                    tooltipFormat: 'yyyy-MM-dd HH:mm', 
                    displayFormats: { 
                        hour: 'HH:mm', 
                        day: 'MMM d', 
                        month: 'MMM yyyy' 
                    } 
                }, 
                ticks: { 
                    autoSkip: true, 
                    maxTicksLimit: 8,
                    maxRotation: 0,
                    padding: 10
                },
                grace: '5%'
            }
        } 
    };
}

export function updateChart(chartInstance, currentSeries, currentSeriesEntries, chartSettings, metrics, analysisSelection) {
    if (!chartInstance || !currentSeries) return;
    chartInstance.options.scales.y.type = chartSettings.logScale ? 'logarithmic' : 'linear';
    let datasets = prepareChartDatasets(currentSeries, currentSeriesEntries, chartSettings, metrics, analysisSelection);
    chartInstance.data.datasets = datasets;
    updateChartTimeRange(chartInstance, chartSettings);
    chartInstance.update();
}

export function prepareChartDatasets(currentSeries, currentSeriesEntries, chartSettings, metrics, analysisSelection) {
    let datasets = [];
    const rId = chartSettings.runningMetric;
    const win = chartSettings.window;
    
    // Filter entries by time range
    let entries = filterByRange(
        currentSeriesEntries, 
        chartSettings.range, 
        chartSettings.customDays
    );
    
    // Raw data mode
    if (chartSettings.period === 'none') {
        const rawData = entries.map(e => ({ x: e.timestamp, y: e.value }));
        datasets.push({ 
            label: 'Raw Data', 
            data: rawData, 
            borderColor: '#4f46e5', 
            tension: 0.2,
            pointRadius: 2
        });
        
        // Add running metric line if configured
        if (rId && win >= 2 && entries.length >= win) {
            const runningData = calculateRunningMetric(
                entries.map(e => e.value),
                entries.map(e => e.timestamp),
                rId,
                win
            );
            datasets.push({ 
                label: `Rolling ${metrics.find(m => m.id === rId)?.label || rId}`, 
                data: runningData, 
                borderColor: '#f59e0b', 
                borderDash: [5, 5], 
                pointRadius: 0, 
                tension: 0.2 
            });
        }
    } 
    // Aggregated period mode
    else {
        const agg = getPeriodData(entries, chartSettings.period);
        
        analysisSelection.forEach(mId => { 
            const metric = metrics.find(x => x.id === mId); 
            if (!metric) return;
            
            const baseData = agg.labels.map((k, i) => ({ x: k, y: agg.datasets[mId][i] }));
            datasets.push({ 
                label: metric.label, 
                data: baseData, 
                borderColor: metric.color, 
                tension: 0.2,
                pointRadius: 2
            }); 
            
            // Add running metric for aggregated data
            if (rId && win >= 2 && agg.labels.length >= win) {
                const runningData = calculateRunningMetric(
                    agg.datasets[mId],
                    agg.labels,
                    rId,
                    win
                );
                datasets.push({ 
                    label: `Rolling ${metric.label} (${rId})`, 
                    data: runningData, 
                    borderColor: metric.color, 
                    borderDash: [8, 4], 
                    borderWidth: 1.5, 
                    pointRadius: 0, 
                    tension: 0.2, 
                    alpha: 0.5 
                });
            }
        });
    }
    
    return datasets;
}

export function updateChartTimeRange(chartInstance, chartSettings) {
    if (!chartInstance) return;
    
    if (chartSettings.range !== 'all') {
        const cutoff = new Date();
        const now = new Date();
        
        switch(chartSettings.range) {
            case 'day': cutoff.setDate(now.getDate() - 1); break;
            case 'week': cutoff.setDate(now.getDate() - 7); break;
            case 'month': cutoff.setMonth(now.getMonth() - 1); break;
            case 'quarter': cutoff.setMonth(now.getMonth() - 3); break;
            case 'year': cutoff.setFullYear(now.getFullYear() - 1); break;
            case 'custom': cutoff.setDate(now.getDate() - chartSettings.customDays); break;
        }
        
        chartInstance.options.scales.x.min = cutoff.getTime();
    } else {
        delete chartInstance.options.scales.x.min;
    }
}

export function getChartInstance() { return chartInstance; }

export function destroyChart() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}