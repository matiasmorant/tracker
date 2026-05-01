import chronosDB from './db.js';
import { format } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import {PeriodSelector, StatSelect} from './period-selector.js'

function getSummaryPreviews(series, entries) {
    if (!series || !entries.length) return [];

    const summaries = series.config?.summaries;

    if (Array.isArray(summaries) && summaries.length > 0) {
        return summaries.map(cfg =>
            calculateSeriesSummary(series, entries, format.duration, cfg) || 'No Data'
        );
    }

    // Legacy fallback
    const legacyCfg = {
        period: 'all',
        operation: series.config?.stat || 'mean',
    };
    return [calculateSeriesSummary(series, entries, format.duration, legacyCfg) || 'No Data'];
}

function SeriesConfiguration() {
    let seriesId;
    let series = null;
    let groups = [];
    let entries = [];
    let loading = true;
    let _dom;

    async function _load() {
        if (!seriesId) return;
        loading = true;
        m.redraw();
        try {
            const id = parseInt(seriesId);
            [series, groups, entries] = await Promise.all([
                chronosDB.series.get(id),
                chronosDB.groups.toArray(),
                chronosDB.entries.where({seriesId: id}).toArray(),
            ]);
            entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (err) {
            console.error('Failed to load series data:', err);
        } finally {
            loading = false;
            m.redraw();
        }
    }

    async function _save() {
        if (!series) return;
        await chronosDB.series.put(series);
        if (_dom) {
            _dom.dispatchEvent(new CustomEvent('series-updated', {
                detail: { seriesId },
                bubbles: true,
            }));
        }
        m.redraw();
    }

    function _ensureConfig() {
        if (!series.config) series.config = {};
    }

    function _ensureSummaries() {
        _ensureConfig();
        if (!Array.isArray(series.config.summaries) || !series.config.summaries.length) {
            series.config.summaries = [{ period: 'all', operation: 'mean' }];
        }
    }

    function _updateSummary(index, key, value) {
        _ensureSummaries();
        series.config.summaries[index][key] = value;
        _save();
    }

    function _addSummary() {
        _ensureSummaries();
        series.config.summaries.push({ period: 'all', operation: 'mean' });
        _save();
    }

    function _removeSummary(index) {
        _ensureSummaries();
        if (series.config.summaries.length <= 1) return;
        series.config.summaries.splice(index, 1);
        _save();
    }

    function _viewSummaryRow(summary, index, total) {
        const periodSettings = {
            range: summary.period,
            customDays: summary.customDays ?? 30,
        };

        return [

            m(StatSelect, {
                value: summary.operation,
                onchange: e => _updateSummary(index, 'operation', e.target.value),
            }),

            m(PeriodSelector, {
                settings: periodSettings,
                onSettingChange: (key, value) => {
                    const updateKey = key === 'range' ? 'period' : key;
                    _updateSummary(index, updateKey, value);
                },
            }),

            m([button,'.plain.small.danger'], {
                onclick: () => _removeSummary(index),
            }, m(icon`trash`+'[label=delete]')),
        ];
    }

    return {
        oninit({attrs}) {
            seriesId = attrs['series-id'];
            _load();
        },

        onupdate({attrs}) {
            if (attrs['series-id'] !== seriesId) {
                seriesId = attrs['series-id'];
                _load();
            }
        },

        view(vnode) {

            const cfg = series?.config ?? {};

            const summaries = cfg?.summaries?.length
                ? cfg.summaries
                : [{ period: 'all', operation: 'mean' }];
            const previews  = getSummaryPreviews(series, entries);

            return m('', {
                oncreate: v => { _dom = v.dom; },
            }, [
                loading
                    ? m('.p-6.text-slate-500', [
                        m('wa-spinner'),
                        m('span.ml-2', 'Loading…'),
                      ])
                    : !series
                    ? m('.p-6.text-slate-500', 'No series selected.')
                    : m('wa-card[appearance=outlined]', [
                        m('h2.text-lg.font-bold[slot=header]', 'Configuration'),

                        m('.masonry-md-lg.gap-3.*:mb-3', [

                            m('wa-select[label=Group]', {
                                value: series.group ?? '',
                                onchange: e => {
                                    series.group = e.target.value;
                                    _save();
                                },
                            }, [
                                m('wa-option[value=]', 'No Group'),
                                groups.map(g =>
                                    m('wa-option', { value: g.name }, g.name)
                                ),
                            ]),

                            m('wa-card', [
                                m('.wa-cluster[slot=header]', 
                                    m(icon`calculator`+'.text-brand'),
                                    m(h3, 'Dashboard Summary'),
                                ),

                                m('.grid.grid-cols-3-auto.gap-2.py-2',
                                    summaries.flatMap((s, i) => _viewSummaryRow(s, i, summaries.length))
                                ),
                                m([button, '.plain.brand.small'], 
                                    { onclick: _addSummary, }, 
                                    m(icon`plus`),
                                    'Add Summary',
                                ),

                                m([callout, '.brand.filled'], [
                                    m(icon`eye`),
                                    previews.length
                                        ? previews.map(p => m('.text-sm.font-black.truncate', p))
                                        : m('.text-sm.italic', 'No Data'),
                                ]),
                            ]),

                            m('wa-card', [

                                m('.wa-cluster[slot=header]', 
                                    m(icon`bolt`+'.text-brand'),
                                    m(h3, 'Quick Add (+) Action'),
                                ),

                                m('wa-select', {
                                    value: cfg.quickAddAction ?? 'manual',
                                    onchange: e => {
                                        _ensureConfig();
                                        series.config.quickAddAction = e.target.value;
                                        _save();
                                    },
                                }, [
                                    m('wa-option[value=manual]', 'Manual Entry Modal'),
                                    series.type === 'number' && m('wa-option[value=increment]', 'One-Click (+1)'),
                                    series.type === 'time' && [
                                        m('wa-option[value=currentTime]', 'Stamp Current Time'),
                                        m('wa-option[value=chronometer]', 'Start/Stop Chronometer'),
                                    ],
                                ]),

                                m([callout, '.neutral.filled'], 
                                    m('p.text-xs.font-bold.text-slate-500.uppercase.mb-1', 'How it works'),
                                    m('p.text-xs.text-slate-500.italic.leading-relaxed', 
                                        'Sets the action triggered by the ',
                                        m('strong.text-indigo-600', 'plus (+)'),
                                        ' icon on your dashboard for this series.',
                                    ),
                                ),
                            ]),
                        ]),
                    ]),
            ]);
        },
    };
}

export default SeriesConfiguration;