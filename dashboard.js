import m from 'https://esm.sh/mithril';
import { formatDuration } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';
import GroupCard from './groupcard.js';

const Dashboard = () => {
    let showFilters = true;
    let series = [];
    let groups = [];
    let selectedGroups = [];
    let updateInterval = null;
    let groupSeriesData = new Map();

    const getSeriesWithSummaries = async (groupName) => {
        const seriesList = await chronosDB.getSeriesByGroup(groupName);
        for (const seriesObj of seriesList) {
            const entries = await chronosDB.getEntriesForSeries(seriesObj.id);
            const configs = seriesObj.config?.summaries || [null];
            seriesObj.summaries = configs.map(config => 
                calculateSeriesSummary(seriesObj, entries, formatDuration, config)
            ).filter(s => s && s.trim() !== '');
        }
        return seriesList;
    };

    const loadData = async () => {
        groupSeriesData.clear();
        
        groups = await chronosDB.getAllGroups();
        groups.sort((a, b) => a.name.localeCompare(b.name));
        
        series = await chronosDB.getAllSeries();
        
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
                    chronosDB.isChrono(s) && chronosDB.isRunning(s)
                );
                if (hasActive) m.redraw();
            }, 1000);
        },

        onremove() {
            if (updateInterval) clearInterval(updateInterval);
        },

        // Export loadData for external access
        loadData,

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
                m(".masonry-xs-md-lg.gap-3.*:mb-3.px-4",
                    groups.length === 0
                    ? m(".text-center.py-8.text-slate-500.dark:text-slate-400", "No groups found. Create some groups to get started!")
                    : filteredGroups.length > 0
                        ? filteredGroups.map(group => {
                            const seriesList = groupSeriesData.get(group.name) || [];
                            return m(GroupCard, {
                                    group: JSON.stringify(group),
                                    seriesList: seriesList,
                                    onseriesclick: (e) => m.route.set(`/series/${e.detail.series.id}`),
                                    onaddentryclick: (e) => console.log("Add entry", e.detail.series),
                                    onseriesupdated: () => loadData() 
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

class DashboardView extends HTMLElement {
    constructor() {
        super();
        this.component = Dashboard(); 
    }

    connectedCallback() {
        m.mount(this, this.component);
    }
    
    async refreshData() {
        await this.component.loadData();
    }

    disconnectedCallback() {
        m.mount(this, null);
    }
}

customElements.define('dashboard-view', DashboardView);

export default Dashboard;