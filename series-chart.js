import { formatDuration } from './utils.js';
import { calculateStats, getPeriodData } from './analytics.js';
import chronosDB from './db.js';
import SeriesChartConfig from './series-chart-config.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METRICS = [
  { id: 'mean',    label: 'Mean',    color: '#4f46e5' },
  { id: 'dayMean', label: 'Day Mean', color: '#10b981' },
  { id: 'sum',     label: 'Sum',     color: '#10b981' },
  { id: 'count',   label: 'Count',   color: '#f59e0b' },
  { id: 'min',     label: 'Min',     color: '#ef4444' },
  { id: 'q1',      label: 'Q1',      color: '#8b5cf6' },
  { id: 'median',  label: 'Median',  color: '#ec4899' },
  { id: 'q3',      label: 'Q3',      color: '#06b6d4' },
  { id: 'max',     label: 'Max',     color: '#1e293b' },
  { id: 'first',   label: 'First',   color: '#6366f1' },
  { id: 'last',    label: 'Last',    color: '#6366f1' },
];

const DEFAULT_CHART_SETTINGS = {
  period: 'none',
  logScale: false,
  runningMetric: '',
  window: 7,
  range: 'all',
  customDays: 30,
  compareSeriesIds: [],
};

const RANGE_DAYS = { day: 1, week: 7, month: 30, quarter: 90, year: 365 };
const COMPARISON_COLORS = ['#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

// ---------------------------------------------------------------------------
// SeriesChart  –  attrs: { seriesId }
// ---------------------------------------------------------------------------

const SeriesChart = () => {
  // ── state ─────────────────────────────────────────────────────────────────
  let series            = null;
  let entries           = [];
  let allSeries         = [];
  let chartSettings     = { ...DEFAULT_CHART_SETTINGS };
  let analysisSelection = ['mean', 'dayMean', 'count'];
  let collapsed         = true;
  let isDark            = isDarkMode();
  let loadedSeriesId    = null;
  let themeObserver     = null;
  let chartEl           = null; // reference to the <chronos-chart> DOM node

  // ── data ──────────────────────────────────────────────────────────────────

  async function loadData(seriesId) {
    try {
      series    = await chronosDB.getSeries(parseInt(seriesId));
      entries   = await chronosDB.getEntriesForSeries(parseInt(seriesId));
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      allSeries = await chronosDB.getAllSeries();

      if (series.config) {
        if (series.config.analysisSelection) {
          analysisSelection = [...series.config.analysisSelection];
        }
        if (series.config.chartSettings) {
          chartSettings = {
            ...DEFAULT_CHART_SETTINGS,
            ...series.config.chartSettings,
            compareSeriesIds: series.config.chartSettings.compareSeriesIds ?? [],
          };
        }
      }
    } catch (err) {
      console.error('Failed to load series data:', err);
    }
    m.redraw();
  }

  // ── chart update ──────────────────────────────────────────────────────────

  async function updateChart() {
    if (!chartEl || !entries.length) return;

    // Compute viewDays
    let viewDays = 0;
    if (chartSettings.range !== 'all') {
      if (chartSettings.range === 'custom' && chartSettings.customDays) {
        viewDays = chartSettings.customDays;
      } else {
        viewDays = RANGE_DAYS[chartSettings.range] ?? 0;
      }
    } else if (entries.length > 0) {
      const first = new Date(entries[0].timestamp);
      const last  = new Date(entries[entries.length - 1].timestamp);
      viewDays = Math.max(1, Math.ceil((last - first) / 864e5));
    }

    const datasets = [];
    const rId = chartSettings.runningMetric;
    const win = chartSettings.window;

    function addSeries(seriesEntries, label, color, isComparison = false) {
      if (chartSettings.period === 'none') {
        datasets.push({
          label,
          data: seriesEntries.map(e => ({ x: e.timestamp, y: e.value })),
          borderColor: color,
          borderWidth: isComparison ? 1.5 : 2,
          tension: 0.2,
          borderDash: isComparison ? [10, 2] : [],
        });

        if (!isComparison && rId && win >= 2 && seriesEntries.length >= win) {
          const runningPoints = [];
          for (let i = 0; i <= seriesEntries.length - win; i++) {
            const slice  = seriesEntries.slice(i, i + win);
            const vals   = slice.map(e => e.value).sort((a, b) => a - b);
            const stats  = calculateStats(vals, [], slice);
            const midIdx = Math.floor(i + (win - 1) / 2);
            runningPoints.push({ x: seriesEntries[midIdx].timestamp, y: stats[rId] });
          }
          if (runningPoints.length > 0) {
            datasets.push({
              label: `Rolling ${METRICS.find(m => m.id === rId)?.label ?? rId}`,
              data: runningPoints,
              borderColor: '#f59e0b',
              borderDash: [10, 2],
              borderWidth: 1.5,
              pointRadius: 0,
              hidePoints: true,
            });
          }
        }
      } else {
        const agg    = getPeriodData(seriesEntries, chartSettings.period);
        const suffix = chartSettings.period === 'day' ? '' : ' 12:00:00.000Z';

        if (isComparison) {
          const points = agg.labels
            .map((k, i) => ({ x: k + suffix, y: agg.datasets['mean'][i] }))
            .filter(p => p.y !== null);
          if (points.length > 0) {
            datasets.push({
              label: `${label} (mean)`,
              data: points,
              borderColor: color,
              borderWidth: 1.5,
              borderDash: [10, 2],
              tension: 0.2,
            });
          }
        } else {
          analysisSelection.forEach(mId => {
            const metric = METRICS.find(x => x.id === mId);
            const points = agg.labels
              .map((k, i) => ({ x: k + suffix, y: agg.datasets[mId][i] }))
              .filter(p => p.y !== null);

            if (points.length > 0) {
              datasets.push({
                label: metric.label,
                data: points,
                borderColor: metric.color,
                borderWidth: 2,
                tension: 0.2,
              });
            }

            if (rId && win >= 2 && agg.labels.length >= win) {
              const runningPoints = [];
              const base = agg.datasets[mId];
              for (let i = 0; i <= base.length - win; i++) {
                const slice      = base.slice(i, i + win).filter(v => v !== null);
                if (!slice.length) continue;
                const stats      = calculateStats([...slice].sort((a, b) => a - b));
                const midIdx     = Math.floor(i + (win - 1) / 2);
                if (stats[rId] !== undefined) {
                  runningPoints.push({ x: agg.labels[midIdx] + suffix, y: stats[rId] });
                }
              }
              if (runningPoints.length > 0) {
                datasets.push({
                  label: `Rolling ${metric.label} (${rId})`,
                  data: runningPoints,
                  borderColor: metric.color,
                  borderDash: [8, 4],
                  borderWidth: 1.5,
                  pointRadius: 0,
                  hidePoints: true,
                });
              }
            }
          });
        }
      }
    }

    // Primary series
    addSeries(entries, series.name, '#4f46e5', false);

    // Comparison series
    if (chartSettings.compareSeriesIds?.length) {
      let colorIndex = 0;
      for (const compareId of chartSettings.compareSeriesIds) {
        const compareSeries = allSeries.find(s => s.id === compareId);
        if (!compareSeries) continue;

        const compareEntries = await chronosDB.getEntriesForSeries(compareId);
        if (!compareEntries.length) continue;

        const allGroups    = await chronosDB.getAllGroups();
        const compareGroup = allGroups.find(g => g.name === compareSeries.group);
        const color        = compareGroup
          ? compareGroup.color
          : COMPARISON_COLORS[colorIndex % COMPARISON_COLORS.length];

        addSeries(compareEntries, compareSeries.name, color, true);
        colorIndex++;
      }
    }

    if (!chartEl) return;

    chartEl.options = {
      ...chartEl.options,
      logScale: chartSettings.logScale,
      darkMode: isDark,
      viewDays,
      grid: {
        show: true,
        color: isDark ? '#334155' : '#e5e7eb',
      },
      axis: {
        show: true,
        color: isDark ? '#cbd5e1' : '#6b7280',
        fontSize: 11,
      },
      valueFormatter: value => {
        if (series?.type === 'time') return formatDuration(value, true);
        return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
      },
    };

    if (!chartEl) return;
    chartEl.data = { datasets };
  }

  // ── event handlers ────────────────────────────────────────────────────────

  function handleToggleCollapsed() {
    collapsed = !collapsed;
    m.redraw();
  }

  function handleScaleClick() {
    chartSettings.logScale = !chartSettings.logScale;
    updateChart();
  }

  function handleConfigUpdated({ series: updatedSeries }) {
    if (updatedSeries.config) {
      if (updatedSeries.config.analysisSelection) {
        analysisSelection = [...updatedSeries.config.analysisSelection];
      }
      if (updatedSeries.config.chartSettings) {
        chartSettings = { ...chartSettings, ...updatedSeries.config.chartSettings };
      }
    }
    updateChart();
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  return {
    oninit({ attrs }) {
      if (attrs.seriesId) {
        loadedSeriesId = attrs.seriesId;
        loadData(attrs.seriesId);
      }
    },

    onbeforeupdate({ attrs }) {
      if (attrs.seriesId && attrs.seriesId !== loadedSeriesId) {
        loadedSeriesId = attrs.seriesId;
        loadData(attrs.seriesId);
      }
    },

    oncreate() {
      themeObserver = new MutationObserver(() => {
        const wasDark = isDark;
        isDark = isDarkMode();
        if (wasDark !== isDark) updateChart();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    },

    onremove() {
      themeObserver?.disconnect();
    },

    view({ attrs }) {
      if (!series) {
        return m('.flex.items-center.justify-center.gap-2.p-4.text-color-neutral-subtle',
          m('wa-spinner'),
          m('span', 'Loading…')
        );
      }

      return m('.wa-stack.gap-0.dark:bg-slate-800.overflow-hidden.h-full',

        // ── Chart ──────────────────────────────────────────────────────────
        m('chronos-chart#seriesChart', {
          style: 'width:100%;height:100%',
          oncreate(vnode) {
            chartEl = vnode.dom;
            chartEl.addEventListener('scale-click', handleScaleClick);
            updateChart();
          },
          onupdate(vnode) {
            chartEl = vnode.dom;
            updateChart();
          },
          onremove() {
            chartEl?.removeEventListener('scale-click', handleScaleClick);
            chartEl = null;
          },
        }),

        // ── Toolbar ────────────────────────────────────────────────────────
        m('.px-4.py-0.border-b.border-slate-100.dark:border-slate-700.flex.justify-between.items-center',
          m('wa-button[appearance=plain][size=small]', {
            onclick: handleToggleCollapsed,
          },
            m(`wa-icon[slot=start][name=${collapsed ? 'chevron-down' : 'chevron-up'}]`),
            collapsed ? 'Statistics' : 'Hide'
          )
        ),

        // ── Config panel ───────────────────────────────────────────────────
        collapsed
          ? null
          : m(SeriesChartConfig, {
              seriesId: attrs.seriesId,
              onConfigUpdated: handleConfigUpdated,
            })
      );
    },
  };
};

export default SeriesChart;