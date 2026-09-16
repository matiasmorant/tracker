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
      const Sentence = '.wa-cluster.items-center.gap-2.text-sm.text-quiet';

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
          m(section, { title: 'Statistics', icon: 'chart-line' },
            m('.wa-stack.gap-9',
              m(Sentence,
                analysisSelection.length > 0 ? 'Show' : 'Add Statistic',
                m('multi-select', {
                  'data-role': 'analysis-select',
                  items: JSON.stringify(METRICS.map(({ id, label, color }) => ({ id, label, color }))),
                  'selected-ids': JSON.stringify(analysisSelection),
                  multi: true,
                  onchange: onAnalysisChange,
                }),
                analysisSelection.length > 0 && [
                  'for each',
                  m(select, {
                    value: settings.period,
                    'data-setting': 'period',
                    onchange: onPeriodChange,
                    options: PERIOD_OPTIONS.map(val => ({
                      value: val,
                      label: val === 'none' ? 'Raw Data' : val[0].toUpperCase() + val.slice(1),
                    })),
                  })
                ]
              ),
              m(Sentence,
                settings.runningMetric ? 'Show running' : 'Add running statistic',
                m(select, {
                    value: settings.runningMetric || '',
                    'data-setting': 'runningMetric',
                    onchange: onRunningMetricChange,
                    options: [
                      { value: '', label: 'None' },
                      ...METRICS.map(({ id, label }) => ({ value: id, label })),
                    ],
                  }),
                settings.runningMetric && [
                  'over last',
                  m('wa-number-input.w-24', {
                    'data-setting': 'window',
                    value: settings.window,
                    min: 2,
                    step: 1,
                    placeholder: 'Win',
                    oninput: onWindowChange,
                  }),
                  'entries',
                ]
              )
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