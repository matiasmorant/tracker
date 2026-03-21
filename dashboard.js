import m from 'https://esm.sh/mithril';
import { formatDuration } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';
import GroupCard from './groupcard.js';

const Dashboard = () => {
    // --- State Logic Encapsulated in Closure ---
    const state = {
        showFilters: true,
        series: [],
        groups: [],
        selectedGroups: [],
        updateInterval: null,
        groupSeriesData: new Map(),

        async loadData() {
            state.groupSeriesData.clear();
            
            state.groups = await chronosDB.getAllGroups();
            state.groups.sort((a, b) => a.name.localeCompare(b.name));
            
            state.series = await chronosDB.getAllSeries();
            
            for (const group of state.groups) {
                const seriesData = await state.getSeriesWithSummaries(group.name);
                state.groupSeriesData.set(group.name, seriesData);
            }
            
            const savedGroups = localStorage.getItem('chronos_selectedGroups');
            if (savedGroups) {
                state.selectedGroups = JSON.parse(savedGroups);
            }
            m.redraw();
        },

        async getSeriesWithSummaries(groupName) {
            const seriesList = await chronosDB.getSeriesByGroup(groupName);
            for (const series of seriesList) {
                const entries = await chronosDB.getEntriesForSeries(series.id);
                const configs = series.config?.summaries || [null];
                series.summaries = configs.map(config => 
                    calculateSeriesSummary(series, entries, formatDuration, config)
                ).filter(s => s && s.trim() !== '');
            }
            return seriesList;
        },

        getFilteredSeries() {
            let res = state.series.filter(s => 
                state.selectedGroups.length === 0 || state.selectedGroups.includes(s.group || '')
            );
            return res.sort((a, b) => {
                const groupA = (a.group || '').toLowerCase();
                const groupB = (b.group || '').toLowerCase();
                if (groupA !== groupB) return groupA.localeCompare(groupB);
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
        },

        getFilteredGroups() {
            if (!state.series.length) {
                return [...state.groups].sort((a, b) => a.name.localeCompare(b.name));
            }
            
            const filteredSeries = state.getFilteredSeries();
            const groupNames = [...new Set(filteredSeries.map(s => s.group).filter(g => g))];
            
            return state.groups
                .filter(g => groupNames.includes(g.name))
                .map(group => ({
                    ...group,
                    seriesCount: filteredSeries.filter(s => s.group === group.name).length
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
    };

    return {
        oninit() {
            state.loadData();
            state.updateInterval = setInterval(() => {
                const hasActive = state.getFilteredSeries().some(s => 
                    chronosDB.isChrono(s) && chronosDB.isRunning(s)
                );
                if (hasActive) m.redraw();
            }, 1000);
        },

        onremove() {
            if (state.updateInterval) clearInterval(state.updateInterval);
        },

        // Allow the Custom Element to access the internal state
        state,

        view() {
            const filteredGroups = state.getFilteredGroups();
            const groupsData = state.groups.map(g => ({
                id: g.name,
                label: g.name,
                color: g.color
            }));

            return m(".space-y-2", [
                // Filter Header
                m(".px-4.py-1.border-b.border-slate-200.flex.flex-wrap.items-center.gap-y-3.dark:border-slate-700", 
                    { class: !state.showFilters ? 'gap-x-8' : '' },
                    [
                        m(".flex.items-center", [
                            m("span#filter-toggle", {
                                class: "text-2xs font-bold text-slate-400 tracking-widest dark:text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors select-none",
                                onclick: () => state.showFilters = !state.showFilters
                            }, "FILTER"),
                            
                            state.showFilters && m(".filters-container.animate-fade-in", [
                                m("multi-select.max-w-44.ml-2", {
                                    items: JSON.stringify(groupsData),
                                    "selected-ids": JSON.stringify(state.selectedGroups),
                                    multi: true,
                                    onchange: (e) => {
                                        state.selectedGroups = e.detail.selection;
                                        localStorage.setItem('chronos_selectedGroups', JSON.stringify(state.selectedGroups));
                                    }
                                })
                            ])
                        ])
                    ]
                ),

                // Content Grid
                m(".masonry-xs-md-lg.gap-3.*:mb-3.px-4",
                    state.groups.length === 0
                    ? m(".text-center.py-8.text-slate-500.dark:text-slate-400", "No groups found. Create some groups to get started!")
                    : filteredGroups.length > 0
                        ? filteredGroups.map(group => {
                            const seriesList = state.groupSeriesData.get(group.name) || [];
                            return m(GroupCard, {
                                    group: JSON.stringify(group),
                                    seriesList: seriesList,
                                    onseriesclick: (e) => m.route.set(`/series/${e.detail.series.id}`),
                                    onaddentryclick: (e) => console.log("Add entry", e.detail.series),
                                    onseriesupdated: () => state.loadData() 
                                });
                        })
                        : m(".column-span-full.text-center.py-8.text-slate-500.dark:text-slate-400", 
                            state.series.length === 0 ? "No series found." : "No series match filters."
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
        await this.component.state.loadData();
    }

    disconnectedCallback() {
        m.mount(this, null);
    }
}

customElements.define('dashboard-view', DashboardView);

export default Dashboard;