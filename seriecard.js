import { format, getRunningTime, elapsedSeconds } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import db from './db.js';

const Summary = ".wa-cluster.wa-gap-0.items-baseline.*:first:(text-xs font-black).*:last:(text-2xs font-bold uppercase ml-1)";

const getButtonIcon = (series, isRunning) => {
    if (isRunning) return m(icon`circle-stop`);
    const action = series.config?.quickAddAction || 'manual';
    switch (action) {
        case 'increment':   return m("span.text-sm.font-black", "+1");
        case 'chronometer': return m(icon`play`);
        case 'currentTime': return m(icon`clock`);
        default:            return m(icon`plus`);
    }
};

const SerieCard = () => {
    let updateInterval = null;
    let entries = [];
    let summaries = [];

    const loadEntries = async (series) => {
        if (!series?.id) return;
        entries = await db.entries.where({seriesId: series.id}).toArray();
        entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        recalculateSummaries(series);
        m.redraw();
    };

    const recalculateSummaries = (series) => {
        if (!series || !entries.length || !series.config) {
            summaries = [];
            return;
        }
        const configs = series.config.summaries && Array.isArray(series.config.summaries)
            ? series.config.summaries
            : [undefined];

        summaries = configs
            .map(cfg => calculateSeriesSummary(series, entries, format.duration, cfg))
            .filter(s => s && s.trim() !== '');
    };

    const handleQuickAdd = async (series, {dom}) => {
        await db.quickAction(series);
        const action = series.config?.quickAddAction || 'manual';

        if (action === 'increment') {
            await loadEntries(series);
            dom.dispatchEvent(new CustomEvent('entry-created', { detail: { series }, bubbles: true }));
        } else if (action === 'chronometer') {
            if (db.isRunning(series)) {
                dom.dispatchEvent(new CustomEvent('series-updated', { detail: { series }, bubbles: true }));
            } else {
                await loadEntries(series);
                dom.dispatchEvent(new CustomEvent('series-updated', { detail: { series }, bubbles: true }));
                dom.dispatchEvent(new CustomEvent('entry-created', { detail: { series }, bubbles: true }));
            }
        } else if (action === 'currentTime') {
            await loadEntries(series);
            dom.dispatchEvent(new CustomEvent('entry-created', { detail: { series }, bubbles: true }));
        } else {
            dom.dispatchEvent(new CustomEvent('add-entry-click', { detail: { series }, bubbles: true }));
        }
    };

    const startTimer = () => {
        if (updateInterval) return;
        updateInterval = setInterval(() => m.redraw(), 1000);
    };

    const stopTimer = () => {
        clearInterval(updateInterval);
        updateInterval = null;
    };

    return {
        oninit: ({attrs}) => loadEntries(attrs.series),

        onupdate: ({attrs}) => {
            const { series } = attrs;
            const isRunning = db.isChrono(series) && db.isRunning(series);
            isRunning ? startTimer() : stopTimer();
        },

        onremove: () => stopTimer(),

        view: (vnode) => {
            const { series, group } = vnode.attrs;
            if (!series) return null;

            const isRunning = db.isChrono(series) && db.isRunning(series);

            const cardStyle = group
                ? { backgroundColor: `${group.color}12`, borderColor: `${group.color}40` }
                : {};

            return m(".px-3.py-0.rounded-xl.border.shadow-sm.transition-all.cursor-pointer.flex.flex-col.justify-center.min-h-[88px].max-h-[120px].relative" +
                ".hover:shadow-md" +
                (group ? '' : ".bg-white.border-slate-200.hover:border-indigo-300.dark:bg-slate-800.dark:border-slate-700.dark:hover:border-indigo-500"),
                {
                    style: cardStyle,
                    onclick: (e) => {
                        const btn = vnode.dom.querySelector('wa-button');
                        if (btn && !btn.contains(e.target)) {
                            vnode.dom.dispatchEvent(new CustomEvent('series-click', { detail: { series }, bubbles: true }));
                        }
                    }
                },
                [
                    m(".flex.flex-col.justify-center.min-w-0.flex-1", [
                        m(".mb-1", [
                            m("span.font-bold.text-slate-800.truncate.leading-tight.dark:text-slate-100", series.name),
                            group && m("span.text-[10px].font-bold.uppercase.tracking-tight.truncate", {
                                style: { color: group.color || '#94a3b8' }
                            }, group.name)
                        ]),
                        m(".mt-1", [
                            isRunning
                                ? m(Summary + ".animate-pulse", [
                                    m("span.text-red-600.dark:text-red-400.running-time", getRunningTime(series)),
                                    m("span.text-red-400.dark:text-red-300", "Running")
                                ])
                                : summaries.length > 0
                                    ? m(".wa-stack.wa-gap-3xs", summaries.map(s => {
                                        const parts = s.split(': ');
                                        if (parts.length >= 2) {
                                            const label = parts[0];
                                            const value = parts.slice(1).join(': ');
                                            return m(Summary, [
                                                m("span.text-brand.truncate", value),
                                                m("span.text-quiet", label)
                                            ]);
                                        }
                                        return m(Summary, [m("span.text-brand.truncate", s)]);
                                    }))
                                    : m("span.text-[10px].text-slate-300.italic.dark:text-slate-600", "No data")
                        ])
                    ]),
                    m([button, '.plain.absolute.bottom-2.right-2.transition-colors'], {
                        class: isRunning ? 'danger animate-pulse' : 'brand',
                        onclick: (e) => {
                            e.stopPropagation();
                            handleQuickAdd(series, vnode);
                        }
                    }, getButtonIcon(series, isRunning))
                ]
            );
        }
    };
};

export default SerieCard;