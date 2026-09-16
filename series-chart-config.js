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
  'text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none ' +
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
      const Sentence = 'span.text-sm.text-quiet';

      return m('#configPanel.p-4',
        m('.wa-stack.gap-4',

          // ── Axis ──────────────────────────────────────────────────────────
          m(section, { title: 'Axis', icon: 'ruler-combined' },
            m('.wa-stack.gap-3',
              m(field, { label: 'Scale' },
                m('wa-radio-group[orientation=horizontal]', {
                  value: settings.logScale ? 'log' : 'linear',
                  onchange: e => onSettingChange('logScale', e.target.value === 'log'),
                },
                  m('wa-radio[appearance=button][value=linear]' , 'Linear'),
                  m('wa-radio[appearance=button][value=log]'    , 'Log'),
                )
              ),
              m(field, { label: 'Range' },
                m(PeriodSelector, {
                  settings,
                  onSettingChange,
                })
              )
            )
          ),

          // ── Statistics ──────────────────────────────────────────────────
          METRICS.length > 0 && m(section, { title: 'Statistics', icon: 'chart-line' },
            m('.wa-cluster.items-center.gap-2', { style: 'flex-wrap: wrap;' },
              m(Sentence, analysisSelection.length > 0 ? 'Show' : 'Add Statistic'),
              m('multi-select', {
                'data-role': 'analysis-select',
                items: JSON.stringify(METRICS.map(({ id, label, color }) => ({ id, label, color }))),
                'selected-ids': JSON.stringify(analysisSelection),
                multi: true,
                onchange: onAnalysisChange,
              }),
              analysisSelection.length > 0 && [
                m(Sentence, 'for each'),
                m('select', {
                  class: SELECT_CLS,
                  'data-setting': 'period',
                  onchange: onPeriodChange,
                },
                  PERIOD_OPTIONS.map(val =>
                    m('option', { value: val, selected: settings.period === val },
                      val === 'none' ? 'Raw Data' : val[0].toUpperCase() + val.slice(1))
                  )
                )
              ]
            )
          ),

          // ── Running Average / Stat ───────────────────────────────────────
          m(section, { title: 'Running Average / Stat', icon: 'wave-square' },
            m('.wa-cluster.items-center.gap-2', { style: 'flex-wrap: wrap;' },
              m(Sentence, settings.runningMetric ? 'Show running' : 'Add running statistic'),
              m('select', {
                class: SELECT_CLS,
                'data-setting': 'runningMetric',
                onchange: onRunningMetricChange,
              },
                m('option', { value: '', selected: !settings.runningMetric }, 'None'),
                METRICS.map(({ id, label }) =>
                  m('option', { value: id, selected: settings.runningMetric === id }, label)
                )
              ),
              settings.runningMetric && [
                m(Sentence, 'over last'),
                m('wa-number-input', {
                  class: 'w-24',
                  'data-setting': 'window',
                  value: settings.window,
                  min: 2,
                  step: 1,
                  placeholder: 'Win',
                  oninput: onWindowChange,
                }),
                m(Sentence, 'entries'),
              ]
            )
          ),

          // ── Compare with other series ────────────────────────────────────
          m(section, { title: 'Compare with other series', icon: 'code-compare' },
            m('multi-select', {
              'data-role': 'compare-select',
              items: JSON.stringify(otherSeries.map(({ id, name }) => ({ id, label: name }))),
              'selected-ids': JSON.stringify(settings.compareSeriesIds ?? []),
              multi: true,
              onchange: onCompareChange,
            })
          )
        )
      );
    },
  };
};

export default SeriesChartConfig;