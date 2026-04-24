import { getRunningTime } from './utils.js';
import chronosDB from './db.js';

const addClass = (child, injected) => {
  const existing = child.attrs.class ?? child.attrs.className ?? '';
  const { className, ...rest } = child.attrs;
  return { ...child, attrs: { ...rest, class: `${injected} ${existing}` } };
};

// const Summary = ".wa-cluster.wa-gap-0.items-baseline.*:first:text-xs.*:first:font-black.*:last:text-2xs.*:last:font-bold.*:last:uppercase.*:last:ml-1";
const Summary = ".wa-cluster.wa-gap-0.items-baseline.*:first:(text-xs font-black).*:last:(text-2xs font-bold uppercase ml-1)";

const GroupCard = () => {
    let updateInterval = null;

    const handleQuickAdd = async (series, {dom}) => {
        await chronosDB.quickAction(series);
        const action = series.config?.quickAddAction || 'manual';

        if (action === 'manual') {
            dom.dispatchEvent(new CustomEvent('add-entry-click', { detail: { series }, bubbles: true }));
        } else {
            dom.dispatchEvent(new CustomEvent('series-updated', { detail: { series }, bubbles: true }));
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
        onupdate: ({attrs}) => {
            const hasActive = attrs.seriesList?.some(s => chronosDB.isChrono(s) && chronosDB.isRunning(s));
            hasActive ? startTimer() : stopTimer();
        },
        onremove: () => stopTimer(),
        view: (vnode) => {
            const group = JSON.parse(vnode.attrs.group);
            const seriesList = vnode.attrs.seriesList || [];
            if (!group || seriesList.length === 0) return null;

            return m(".wa-stack.wa-gap-3xs.px-3.py-1.rounded-xl.border.shadow-sm.overflow-hidden.transition-all.hover:shadow-md", {
                style: { borderColor: `${group.color}40`, backgroundColor: `${group.color}12` }
            }, [
                m("h3.border-b.text-2xs.font-bold.uppercase.tracking-widest.truncate", { style: { color: group.color } }, group.name),

                seriesList.map(series => {
                    const isRunning = chronosDB.isChrono(series) && chronosDB.isRunning(series);
                    
                    return m(".wa-split.wa-gap-0.dark:hover:bg-slate-700/50.cursor-pointer.transition-colors", {
                        onclick: () => vnode.dom.dispatchEvent(new CustomEvent('series-click', { detail: { series }, bubbles: true }))
                    }, [
                        m(".wa-stack.wa-gap-3xs.min-w-0", [
                            m("span.font-bold.text-sm.text-normal.truncate", series.name),
                            ...(isRunning 
                                ? [m(Summary+".animate-pulse", [
                                    m("span.text-red-600.dark:text-red-400", getRunningTime(series)),
                                    m("span.text-red-400.dark:text-red-300", "Running")
                                  ])]
                                : (series.summaries?.length > 0 
                                    ? series.summaries.map(s => {
                                        const [label,value] = s.split(': ');
                                        return m(Summary, [
                                            m("span.text-brand.truncate", value),
                                            m("span.text-quiet", label)
                                        ]);
                                    })
                                    : [m("span", { class: "text-[9px] text-slate-300 italic dark:text-slate-600" }, "No data")]
                                  )
                            )
                        ]),
                        // Action Button
                        m([button, '.plain.transition-colors'], {
                            class: (isRunning ? 'danger animate-pulse' : 'brand'),
                            onclick: (e) => {
                                e.stopPropagation();
                                handleQuickAdd(series, vnode);
                            }
                        }, getButtonIcon(series, isRunning))
                    ]);
                })
            ]);
        }
    };
};

const getButtonIcon = (series, isRunning) => {
    if (isRunning) return m(icon`circle-stop`);
    const action = series.config?.quickAddAction || 'manual';
    switch(action) {
        case 'increment': return m("span.text-sm.font-black", "+1");
        case 'chronometer': return m(icon`play`);
        case 'currentTime': return m(icon`clock`);
        default: return m(icon`plus`);
    }
};

export default GroupCard;
