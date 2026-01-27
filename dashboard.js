import m from 'https://esm.sh/mithril';
import { formatDuration, getFormattedISO, getRunningTime } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';
import GroupCard from './groupcard.js';

// We assume <group-card> and <multi-select> are either other Mithril components 
// or custom elements. For this reimplementation, we'll treat them as 
// Mithril-compatible tags/components.

const Dashboard = {
    // --- State ---
    showFilters: true,
    series: [],
    groups: [],
    selectedGroups: [],
    updateInterval: null,
    groupSeriesData: new Map(), // Cache for series data per group

    // --- Data Logic ---
    async loadData() {
        this.groups = await chronosDB.getAllGroups();
        this.groups.sort((a, b) => a.name.localeCompare(b.name));
        
        this.series = await chronosDB.getAllSeries();
        
        // Load series data for all groups
        for (const group of this.groups) {
            const seriesData = await this.getSeriesWithSummaries(group.name);
            this.groupSeriesData.set(group.name, seriesData);
        }
        
        const savedGroups = localStorage.getItem('chronos_selectedGroups');
        if (savedGroups) {
            this.selectedGroups = JSON.parse(savedGroups);
        }
        m.redraw();
    },

    async refreshGroupData(groupName) {
        const seriesData = await this.getSeriesWithSummaries(groupName);
        this.groupSeriesData.set(groupName, seriesData);
        m.redraw();
    },

    getFilteredSeries() {
        let res = this.series.filter(s => 
            this.selectedGroups.length === 0 || this.selectedGroups.includes(s.group || '')
        );
        return res.sort((a, b) => {
            const groupA = (a.group || '').toLowerCase();
            const groupB = (b.group || '').toLowerCase();
            if (groupA !== groupB) return groupA.localeCompare(groupB);
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    },

    getFilteredGroups() {
        if (!this.series.length) {
            return [...this.groups].sort((a, b) => a.name.localeCompare(b.name));
        }
        
        const filteredSeries = this.getFilteredSeries();
        const groupNames = [...new Set(filteredSeries.map(s => s.group).filter(g => g))];
        
        return this.groups
            .filter(g => groupNames.includes(g.name))
            .map(group => ({
                ...group,
                seriesCount: filteredSeries.filter(s => s.group === group.name).length
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
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

    // --- Realtime Logic ---
    startRealtimeUpdates() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => {
            const hasActive = this.getFilteredSeries().some(s => 
                chronosDB.isChrono(s) && chronosDB.isRunning(s)
            );
            if (hasActive) {
                // In Mithril, we just trigger a redraw to update UI 
                // instead of manual DOM queries
                m.redraw();
            }
        }, 1000);
    },

    // --- Lifecycle ---
    oninit() {
        this.loadData();
        this.startRealtimeUpdates();
    },

    onremove() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    },

    // --- View ---
    view() {
        const filteredGroups = this.getFilteredGroups();
        const groupsData = this.groups.map(g => ({
            id: g.name,
            label: g.name,
            color: g.color
        }));

        return m(".space-y-6", [
            // Filter Header
            m(".py-1.border-b.border-slate-200.flex.flex-wrap.items-center.gap-y-3.dark:border-slate-700", 
                { class: !this.showFilters ? 'gap-x-8' : '' },
                [
                    m(".flex.items-center", [
                        m("span#filter-toggle", {
                            class: "text-[10px] font-bold text-slate-400 tracking-widest dark:text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors select-none",
                            onclick: () => this.showFilters = !this.showFilters
                        }, "FILTER"),
                        
                        // Filter Container with simple conditional rendering 
                        // (Mithril handles the presence/absence of the node)
                        this.showFilters && m(".filters-container.animate-fade-in", [
                            m("multi-select.max-w-44.ml-2", {
                                items: JSON.stringify(groupsData),
                                "selected-ids": JSON.stringify(this.selectedGroups),
                                multi: true,
                                onchange: (e) => {
                                    this.selectedGroups = e.detail.selection;
                                    localStorage.setItem('chronos_selectedGroups', JSON.stringify(this.selectedGroups));
                                }
                            })
                        ])
                    ])
                ]
            ),

            // Content Grid
            m("div", {class:"columns-1 min-[400px]:columns-2 md:columns-3 lg:columns-4 gap-3"},
                this.groups.length === 0 
                ? m(".text-center.py-8.text-slate-500.dark:text-slate-400", "No groups found. Create some groups to get started!")
                : filteredGroups.length > 0 
                    ? filteredGroups.map(group => {
                        const seriesList = this.groupSeriesData.get(group.name) || [];
                        return m(".break-inside-avoid.mb-3", [
                            m(GroupCard, {
                                group: JSON.stringify(group),
                                seriesList: seriesList,
                                // Handle custom events from the web component
                                onseriesclick: (e) => m.route.set(`/series/${e.detail.series.id}`), // Example action
                                onaddentryclick: (e) => console.log("Add entry", e.detail.series),
                                onseriesupdated: () => this.refreshGroupData(group.name)
                            })
                        ]);
                    })
                    : m(".column-span-full.text-center.py-8.text-slate-500.dark:text-slate-400", 
                        this.series.length === 0 ? "No series found." : "No series match filters."
                    )
            )
        ]);
    }
};

class DashboardView extends HTMLElement {
    connectedCallback() {
        // Mount Mithril to this custom element
        m.mount(this, Dashboard);
    }
    
    async refreshData() {
        await Dashboard.loadData();
        m.redraw();
    }

    disconnectedCallback() {
        // Unmount when removed from DOM
        m.mount(this, null);
    }
}

// Register the tag so <dashboard-view> works in HTML
customElements.define('dashboard-view', DashboardView);

export default Dashboard;