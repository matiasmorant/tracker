import { formatDuration, getFormattedISO } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

export const State = {
    view: 'list',
    detailSubView: 'chart',
    series: [],
    currentSeries: null,
    currentSeriesEntries: [],
    theme: localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    modals: { series: false, entry: false, group: false },
    toast: { show: false, message: '' },
    tabs: [
        {id: 'chart', icon: 'fa-chart-line'},
        {id: 'calendar', icon: 'fa-calendar-days'},
        {id: 'history', icon: 'fa-table-list'},
        {id: 'config', icon: 'fa-gear'}
    ]
};

export const Actions = {
    showToast(msg) {
        State.toast.message = msg;
        State.toast.show = true;
        m.redraw();
        setTimeout(() => {
            State.toast.show = false;
            m.redraw();
        }, 3000);
    },
    async loadSeries() {
        State.series = await chronosDB.getAllSeries();
        const dashboard = document.querySelector('dashboard-view');
        if (dashboard && dashboard.refreshData) await dashboard.refreshData();
        m.redraw();
    },
    async loadEntries(id) {
        const entries = await chronosDB.getEntriesForSeries(id);
        State.currentSeriesEntries = entries.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        Actions.recalculateSummaryDisplay();
        m.redraw();
    },
    recalculateSummaryDisplay() {
        if (!State.currentSeries || !State.currentSeriesEntries.length || !State.currentSeries.config) return;
        const config = State.currentSeries.config;
        State.currentSeries.summaryDisplay = (config.summaries && Array.isArray(config.summaries)) 
            ? config.summaries.map(s => calculateSeriesSummary(State.currentSeries, State.currentSeriesEntries, formatDuration, s)).filter(s => s && s.trim() !== '')
            : calculateSeriesSummary(State.currentSeries, State.currentSeriesEntries, formatDuration);
    },
    openNewSeriesModal() {
        State.modals.series = true;
        m.redraw();
        setTimeout(() => {
            const el = document.querySelector('series-modal');
            if (el) { el.loadGroups(); el.openForNew(); }
        }, 0);
    },
    async openSeriesDetail(s) {
        State.currentSeries = s;
        State.view = 'detail';
        State.detailSubView = 'chart';
        await Actions.loadEntries(s.id);
        setTimeout(() => {
            const header = document.querySelector('detail-header');
            if (header) header.setCurrentSeries(s);
        }, 0);
        m.redraw();
    },
    openAddEntryModal(s) {
        State.modals.entry = true;
        m.redraw();
        setTimeout(() => {
            const el = document.querySelector('entry-modal');
            if (el) el.openForNew(s);
        }, 0);
    },
    editEntry(e) {
        State.modals.entry = true;
        m.redraw();
        setTimeout(() => {
            const el = document.querySelector('entry-modal');
            if (el) el.openForEdit(e, State.currentSeries);
        }, 0);
    },
    async deleteEntry(id) {
        if (confirm('Delete entry?')) {
            await chronosDB.deleteEntry(id);
            await Actions.loadEntries(State.currentSeries.id);
        }
    },
    openGroupManager() {
        State.modals.group = true;
        m.redraw();
        setTimeout(() => {
            const el = document.querySelector('group-manager');
            if (el) el.resetForm();
        }, 0);
    },
    async exportData() {
        try {
            const obj = await chronosDB.exportJSON();
            const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chronos_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            Actions.showToast('JSON Exported');
        } catch (err) { Actions.showToast('Export failed'); }
    },
    async exportCSV() {
        try {
            const csv = await chronosDB.exportCSV();
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `chronos_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.click();
            Actions.showToast('CSV Exported');
        } catch (err) { Actions.showToast('CSV Export failed'); }
    },
    updateTheme(newTheme) {
        State.theme = newTheme;
        localStorage.setItem('theme', newTheme);
        const doc = document.documentElement;
        if (newTheme === 'dark') {
            doc.classList.add('dark', 'sl-theme-dark');
            doc.classList.remove('sl-theme-light');
        } else {
            doc.classList.remove('dark', 'sl-theme-dark');
            doc.classList.add('sl-theme-light');
        }
        m.redraw();
    }
};
