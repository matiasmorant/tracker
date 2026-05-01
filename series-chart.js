import { format } from './utils.js';
import { calculateStat, calculateRunningMetric } from './analytics.js';
import db from './db.js';
import SeriesChartConfig from './series-chart-config.js';

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

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

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
    series    = await db.series.get(parseInt(seriesId));
    entries   = await db.entries.where({seriesId: parseInt(seriesId)}).toArray();
    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    allSeries = await db.series.toArray();

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
    m.redraw();
  }

  async function updateChart() {
    if (!chartEl || !entries.length) return;

    // Compute viewDays
    let viewDays = 0;
    if (chartSettings.range !== 'all') {
      viewDays = (chartSettings.range === 'custom' && chartSettings.customDays)
        ? chartSettings.customDays
        : ( RANGE_DAYS[chartSettings.range] ?? 0 );
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

        if (!isComparison && rId && win >= 2) {
          const runningPoints = calculateRunningMetric(
            seriesEntries, rId, win
          ).map(p => ({ x: p.timestamp, y: p.value }));

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
        const suffix = chartSettings.period === 'day' ? '' : ' 12:00:00.000Z';

        if (isComparison) {
          const points = calculateStat(seriesEntries, 'mean', chartSettings.period)
            .map(p => ({ x: p.timestamp + suffix, y: p.value }));

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
            const points = calculateStat(seriesEntries, mId, chartSettings.period);
            const chartPoints = points.map(p => ({ x: p.timestamp + suffix, y: p.value }));

            if (chartPoints.length > 0) {
              datasets.push({
                label: metric.label,
                data: chartPoints,
                borderColor: metric.color,
                borderWidth: 2,
                tension: 0.2,
              });

              if (rId && win >= 2) {
                const runningPoints = calculateRunningMetric(
                  points, rId, win
                ).map(p => ({ x: p.timestamp + suffix, y: p.value }));

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

        const compareEntries = await db.entries.where({seriesId: compareId}).toArray();
        if (!compareEntries.length) continue;

        const allGroups    = await db.groups.toArray();
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
        if (series?.type === 'time') return format.duration(value, true);
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
        m('chronos-chart#seriesChart.w-full.h-full', {
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
          m([button, '.plain.small'], { onclick: handleToggleCollapsed, },
            m(icon(collapsed ? 'chevron-down' : 'chevron-up')),
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