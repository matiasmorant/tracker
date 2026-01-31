import m from 'https://esm.sh/mithril';
import { formatDuration, getRunningTime } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

const GroupCard = () => {
    let updateInterval = null;

    const handleQuickAdd = async (series, vnode) => {
        await chronosDB.quickAction(series);
        const action = series.config?.quickAddAction || 'manual';

        if (action === 'manual') {
            vnode.dom.dispatchEvent(new CustomEvent('add-entry-click', { detail: { series }, bubbles: true }));
        } else {
            vnode.dom.dispatchEvent(new CustomEvent('series-updated', { detail: { series }, bubbles: true }));
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
        onupdate: (vnode) => {
            const hasActive = vnode.attrs.seriesList?.some(s => chronosDB.isChrono(s) && chronosDB.isRunning(s));
            hasActive ? startTimer() : stopTimer();
        },
        onremove: () => stopTimer(),
        view: (vnode) => {
            const group = JSON.parse(vnode.attrs.group);
            const seriesList = vnode.attrs.seriesList || [];
            if (!group || seriesList.length === 0) return null;

            return m("div", {
                class: "rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md",
                style: { borderColor: `${group.color}40`, backgroundColor: `${group.color}12` }
            }, [
                // Header
                m("div", {
                    class: "px-3 pt-1 border-b flex justify-between items-center"
                }, 
                    m("span", { class: "text-[10px] font-bold uppercase tracking-widest truncate", style: { color: group.color } }, group.name)
                ),

                // Series List
                m("div", {
                    class: "flex flex-col divide-y divide-slate-100 dark:divide-slate-700"
                }, 
                    seriesList.map(series => {
                        const isRunning = chronosDB.isChrono(series) && chronosDB.isRunning(series);
                        
                        return m("div", {
                            class: "series-row px-3 py-1 dark:hover:bg-slate-700/50 cursor-pointer flex items-center justify-between transition-colors",
                            onclick: () => vnode.dom.dispatchEvent(new CustomEvent('series-click', { detail: { series }, bubbles: true }))
                        }, [
                            m("div", {
                                class: "flex flex-col min-w-0 flex-1"
                            }, [
                                m("span", { class: "font-bold text-sm text-slate-800 truncate dark:text-slate-100 mb-0.5" }, series.name),
                                m("div", { class: "flex flex-col min-h-[16px]"}, isRunning 
                                    ? m("div", { class: "flex items-baseline animate-pulse" }, [
                                        m("span", { class: "text-[11px] font-black text-red-600 dark:text-red-400" }, getRunningTime(series)),
                                        m("span", { class: "text-[9px] font-bold text-red-400 uppercase ml-1.5 dark:text-red-300" }, "Running")
                                      ])
                                    : m("div", {
                                        class: "flex flex-col gap-[1px]"
                                    }, 
                                        series.summaries?.length > 0 
                                            ? series.summaries.map(s => renderSummary(s))
                                            : m("span", { class: "text-[9px] text-slate-300 italic dark:text-slate-600" }, "No data")
                                      )
                                )
                            ]),
                            // Action Button
                            m("button", {
                                class: "ml-3 p-2 rounded-lg transition-colors " + (isRunning ? 'bg-red-50 text-red-600 animate-pulse dark:bg-red-900/20' : 'text-indigo-600'),
                                onclick: (e) => {
                                    e.stopPropagation();
                                    handleQuickAdd(series, vnode);
                                }
                            }, getButtonIcon(series, isRunning))
                        ]);
                    })
                )
            ]);
        }
    };
};

// Helper: Parsing and rendering the summary string
const renderSummary = (summaryText) => {
    const parts = summaryText.split(': ');
    const value = parts.length >= 2 ? parts.slice(1).join(': ') : summaryText;
    const label = parts.length >= 2 ? parts[0] : null;

    return m("div", {
        class: "flex items-baseline"
    }, [
        m("span", { class: "text-[11px] font-black text-indigo-600 truncate dark:text-indigo-400" }, value),
        label && m("span", { class: "text-[9px] font-bold text-slate-400 uppercase ml-1.5 dark:text-slate-500" }, label)
    ]);
};

// Helper: Determine button icon
const getButtonIcon = (series, isRunning) => {
    if (isRunning) return m("i", { class: "fa-solid fa-circle-stop text-base" });
    const action = series.config?.quickAddAction || 'manual';
    switch(action) {
        case 'increment': return m("span", { class: "text-sm font-black" }, "+1");
        case 'chronometer': return m("i", { class: "fa-solid fa-play text-base" });
        case 'currentTime': return m("i", { class: "fa-solid fa-clock text-base" });
        default: return m("i", { class: "fa-solid fa-plus text-base" });
    }
};

export default GroupCard;
