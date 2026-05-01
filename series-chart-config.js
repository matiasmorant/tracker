import db from './db.js';
import {PeriodSelector} from './period-selector.js';

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

const DEFAULT_SETTINGS = {
  period: 'none',
  logScale: false,
  runningMetric: '',
  window: 7,
  range: 'all',
  customDays: 30,
  compareSeriesIds: [],
};

const PERIOD_OPTIONS = ['none', 'day', 'week', 'month', 'quarter', 'year'];

const SELECT_CLS =
  'text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none ' +
  'focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100';

// ---------------------------------------------------------------------------
// SeriesChartConfig  –  attrs: { seriesId, onConfigUpdated? }
// ---------------------------------------------------------------------------

const SeriesChartConfig = () => {
  // ── state ─────────────────────────────────────────────────────────────────
  let series            = null;
  let allSeries         = [];
  let chartSettings     = {};
  let analysisSelection = [];
  let loadedSeriesId    = null;
  let onConfigUpdated   = null;

  // ── data ──────────────────────────────────────────────────────────────────

  async function loadData(seriesId) {
    series    = await db.series.get(parseInt(seriesId));
    allSeries = await db.series.toArray();
    chartSettings     = series.config?.chartSettings     ?? {};
    analysisSelection = series.config?.analysisSelection ?? [];
    m.redraw();
  }

  async function save() {
    if (!series) return;

    series.config = {
      ...series.config,
      analysisSelection: [...analysisSelection],
      chartSettings: { ...chartSettings },
    };

    await db.series.put(series);
    m.redraw();

    onConfigUpdated?.({ series });
  }

  // ── event handlers ────────────────────────────────────────────────────────

  const onAnalysisChange      = e      => { analysisSelection              = e.detail.selection;            save(); };
  const onPeriodChange        = e      => { chartSettings.period           = e.target.value;                save(); };
  const onRunningMetricChange = e      => { chartSettings.runningMetric    = e.target.value;                save(); };
  const onWindowChange        = e      => { chartSettings.window           = parseInt(e.target.value) || 7; save(); };
  const onCompareChange       = e      => { chartSettings.compareSeriesIds = e.detail.selection;            save(); };
  const onSettingChange       = (k, v) => { chartSettings[k]               = v;                             save(); };

  // ── component ─────────────────────────────────────────────────────────────

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

    view({ attrs }) {
      onConfigUpdated = attrs.onConfigUpdated;

      if (!series) {
        return m('.p-4.text-slate-500', 'Loading configuration...');
      }

      const otherSeries = allSeries.filter(s => s.id !== series.id);
      const settings    = { ...DEFAULT_SETTINGS, ...chartSettings };

      return m('#configPanel.border-t.border-slate-100.dark:border-slate-700',
        m('.p-4',

          // ── Statistics ──────────────────────────────────────────────────
          m('.statistics-section',
            m('h3.text-2xs.font-bold.text-slate-400.uppercase.tracking-widest.dark:text-slate-500',
              'Statistics'),

            METRICS.length > 0 && m('.flex.flex-row.gap-2.mt-2',
              m('multi-select', {
                'data-role': 'analysis-select',
                items: JSON.stringify(METRICS.map(({ id, label, color }) => ({ id, label, color }))),
                'selected-ids': JSON.stringify(analysisSelection),
                multi: true,
                onchange: onAnalysisChange,
              }),

              m('.flex.flex-col.gap-1\\.5',
                m('span.text-2xs.font-bold.text-slate-400.uppercase.tracking-tighter.dark:text-slate-500',
                  'Period Grouping'),
                m('select.text-xs.border.border-slate-200.rounded-md.px-2.py-1\\.5.bg-slate-50.outline-none.focus:ring-1.focus:ring-indigo-500.dark:bg-slate-700.dark:border-slate-600.dark:text-slate-100', {
                  'data-setting': 'period',
                  onchange: onPeriodChange,
                },
                  PERIOD_OPTIONS.map(val =>
                    m('option', { value: val, selected: settings.period === val },
                      val === 'none' ? 'Raw Data' : val[0].toUpperCase() + val.slice(1))
                  )
                )
              )
            )
          ),

          // ── Running Average / Stat ───────────────────────────────────────
          m('.flex.flex-wrap.items-center.gap-4.my-3',
            m('.flex.flex-col.gap-1\\.5',
              m('span.text-2xs.font-bold.text-slate-400.uppercase.tracking-tighter.dark:text-slate-500',
                'Running Average/Stat'),
              m('.flex.items-center.space-x-2',
                m('select.text-xs.border.border-slate-200.rounded-md.px-2.py-1\\.5.bg-slate-50.outline-none.focus:ring-1.focus:ring-indigo-500.dark:bg-slate-700.dark:border-slate-600.dark:text-slate-100', {
                  'data-setting': 'runningMetric',
                  onchange: onRunningMetricChange,
                },
                  m('option', { value: '', selected: !settings.runningMetric }, 'None'),
                  METRICS.map(({ id, label }) =>
                    m('option', { value: id, selected: settings.runningMetric === id }, label)
                  )
                ),
                m('input.w-14.text-xs.border.border-slate-200.rounded-md.px-2.py-1\\.5.bg-slate-50.outline-none.focus:ring-1.focus:ring-indigo-500.dark:bg-slate-700.dark:border-slate-600.dark:text-slate-100', {
                  type: 'number',
                  'data-setting': 'window',
                  value: settings.window,
                  min: 2,
                  step: 1,
                  placeholder: 'Win',
                  oninput: onWindowChange,
                })
              )
            )
          ),

          // ── Time Range ───────────────────────────────────────────────────
          m('.flex.flex-row.gap-2.mt-4.pt-4.border-t.border-slate-100.dark:border-slate-700',
            m('h3.content-center.text-2xs.font-bold.text-slate-400.uppercase.tracking-widest.dark:text-slate-500',
              'Time Range'),
            m(PeriodSelector, {
              settings,
              onSettingChange,
            })
          ),

          // ── Compare with other series ────────────────────────────────────
          m('.p-4.border-t.border-slate-100.dark:border-slate-700',
            m('h3.text-2xs.font-bold.text-slate-400.uppercase.tracking-widest.dark:text-slate-500.mb-2',
              'Compare with other series'),
            m('.flex.flex-row.gap-2',
              m('multi-select.flex-1', {
                'data-role': 'compare-select',
                items: JSON.stringify(otherSeries.map(({ id, name }) => ({ id, label: name }))),
                'selected-ids': JSON.stringify(settings.compareSeriesIds ?? []),
                multi: true,
                onchange: onCompareChange,
              })
            )
          )
        )
      );
    },
  };
};

export default SeriesChartConfig;