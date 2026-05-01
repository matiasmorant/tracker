import { format } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import db from './db.js';
import GroupCard from './groupcard.js';
import { State, Actions } from './mithril-state-actions.js';
import EntryModal from './entry-modal.js';


let series = [];
let groups = [];
let groupSeriesData = new Map();
let selectedGroups = [];

const getSeriesWithSummaries = async (group) => {
    const seriesList = await db.series.where({group}).toArray();
    for (const serie of seriesList) {
        const entries = await db.entries.where({seriesId: serie.id}).toArray();
        const configs = serie.config?.summaries || [null];
        serie.summaries = configs.map(config => 
            calculateSeriesSummary(serie, entries, format.duration, config)
        ).filter(s => s && s.trim() !== '');
    }
    return seriesList;
};

const loadData = async () => {        
    groups = await db.groups.toArray();
    groups.sort((a, b) => a.name.localeCompare(b.name));
    
    series = await db.series.toArray();
    
    groupSeriesData.clear();
    for (const group of groups) {
        const seriesData = await getSeriesWithSummaries(group.name);
        groupSeriesData.set(group.name, seriesData);
    }
    
    const savedGroups = localStorage.getItem('chronos_selectedGroups');
    if (savedGroups) {
        selectedGroups = JSON.parse(savedGroups);
    }
    m.redraw();
};

const Dashboard = () => {
    let showFilters = true;
    let updateInterval = null;

    const getFilteredSeries = () => {
        let res = series.filter(s => 
            selectedGroups.length === 0 || selectedGroups.includes(s.group || '')
        );
        return res.sort((a, b) => {
            const groupA = (a.group || '').toLowerCase();
            const groupB = (b.group || '').toLowerCase();
            if (groupA !== groupB) return groupA.localeCompare(groupB);
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    };

    const getFilteredGroups = () => {
        if (!series.length) {
            return [...groups].sort((a, b) => a.name.localeCompare(b.name));
        }
        
        const filteredSeries = getFilteredSeries();
        const groupNames = [...new Set(filteredSeries.map(s => s.group).filter(g => g))];
        
        return groups
            .filter(g => groupNames.includes(g.name))
            .map(group => ({
                ...group,
                seriesCount: filteredSeries.filter(s => s.group === group.name).length
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    return {
        oninit() {
            loadData();
            updateInterval = setInterval(() => {
                const hasActive = getFilteredSeries().some(s => 
                    db.isChrono(s) && db.isRunning(s)
                );
                if (hasActive) m.redraw();
            }, 1000);
        },

        onremove() {
            if (updateInterval) clearInterval(updateInterval);
        },

        view() {
            const filteredGroups = getFilteredGroups();
            const groupsData = groups.map(g => ({
                id: g.name,
                label: g.name,
                color: g.color
            }));

            return m(".space-y-2", [
                // Filter Header
                m(".px-4.py-1.border-b.border-slate-200.flex.flex-wrap.items-center.gap-y-3.dark:border-slate-700", 
                    { class: !showFilters ? 'gap-x-8' : '' },
                    [
                        m(".flex.items-center", [
                            m("span#filter-toggle", {
                                class: "text-2xs font-bold text-slate-400 tracking-widest dark:text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors select-none",
                                onclick: () => showFilters = !showFilters
                            }, "FILTER"),
                            
                            showFilters && m(".filters-container.animate-fade-in", [
                                m("multi-select.max-w-44.ml-2", {
                                    items: JSON.stringify(groupsData),
                                    "selected-ids": JSON.stringify(selectedGroups),
                                    multi: true,
                                    onchange: (e) => {
                                        selectedGroups = e.detail.selection;
                                        localStorage.setItem('chronos_selectedGroups', JSON.stringify(selectedGroups));
                                    }
                                })
                            ])
                        ])
                    ]
                ),

                // Content Grid
                groups.length === 0
                ? m(".text-center.py-8.text-slate-500.dark:text-slate-400", "No groups found. Create some groups to get started!")
                : m(".masonry-xs-md-lg.gap-3.*:mb-3.px-4",
                    filteredGroups.length > 0
                        ? filteredGroups.map(group => {
                            const seriesList = groupSeriesData.get(group.name) || [];
                            return m(GroupCard, {
                                group: JSON.stringify(group),
                                seriesList,
                                onseriesClick: Actions.openSeriesDetail,
                                onaddEntryClick: (series) => EntryModal.open({series}),
                                onseriesUpdated: Actions.loadSeries,
                                onentryCreated: Actions.loadSeries
                            });
                        })
                        : m(".column-span-full.text-center.py-8.text-slate-500.dark:text-slate-400", 
                            series.length === 0 ? "No series found." : "No series match filters."
                        )
                )
            ]);
        }
    };
};

Dashboard.loadData = loadData;
export default Dashboard;