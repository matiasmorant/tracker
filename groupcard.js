import { formatDuration, getFormattedISO, getRunningTime } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

export class GroupCard extends HTMLElement {
    constructor() {
        super();
        this.group = null;
        this.series = [];
        this.updateInterval = null;
        this.filteredSeries = []; // Keep if you still need internal filtering
    }

    // Only observe 'group' attribute now
    static get observedAttributes() { return ['group']; }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'group') {
            this.group = newValue ? JSON.parse(newValue) : null;
            // Fetch series from DB when group changes
            await this.fetchSeriesForGroup();
            await this.refreshAllSummaries();
            this.render();
            this.toggleTimer();
        }
    }

    async connectedCallback() {
        // If group is already set via attribute, fetch series
        if (this.group) {
            await this.fetchSeriesForGroup();
        }
        await this.refreshAllSummaries();
        this.render();
        this.toggleTimer();
    }

    disconnectedCallback() { this.stopTimer(); }

    async fetchSeriesForGroup() {
        if (!this.group || !this.group.name) {
            this.series = [];
            return;
        }
        // Assuming chronosDB has a method to get series by group
        this.series = await chronosDB.getSeriesByGroup(this.group.name);
        // If you still need filteredSeries, adjust accordingly
        this.filteredSeries = [...this.series]; // or apply filtering logic
    }

    eventSend(name, series) { 
        this.dispatchEvent(new CustomEvent(name, {detail: {series}, bubbles: true, composed: true})); 
    }

    async refreshAllSummaries() {
        const groupSeries = this.getGroupSeries();
        for (const series of groupSeries) {
            const entries = await chronosDB.getEntriesForSeries(series.id);
            
            if (series.config?.summaries && Array.isArray(series.config.summaries)) {
                const summaries = series.config.summaries.map(summaryConfig => {
                    return calculateSeriesSummary(
                        series,
                        entries,
                        formatDuration.bind(this),
                        summaryConfig
                    );
                }).filter(summary => summary && summary.trim() !== '');
                
                series.summaries = summaries;
            } else {
                const singleSummary = calculateSeriesSummary(
                    series,
                    entries,
                    formatDuration.bind(this)
                );
                series.summaries = singleSummary ? [singleSummary] : [];
            }
        }
    }

    async handleQuickAdd(series) {
        await chronosDB.quickAction(series);

        const action = series.config?.quickAddAction || 'manual';
        if (action === 'increment') { await this.handleSeriesUpdate(series); }
        if (action === 'chronometer') { await this.handleSeriesUpdate(series); this.toggleTimer(); }
        if (action === 'currentTime') { await this.handleSeriesUpdate(series); }
        if (action === 'manual'){ this.eventSend('add-entry-click', series); }
    }

    async handleSeriesUpdate(series) { 
        await this.refreshAllSummaries();
        this.render();
        this.eventSend('entry-created', series);
        this.eventSend('series-updated', series);
    }

    toggleTimer() {
        const hasActiveChronometer = this.getGroupSeries().some(s => chronosDB.isChrono(s) && chronosDB.isRunning(s) );
        hasActiveChronometer ? this.startTimer() : this.stopTimer();
    }

    startTimer() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => { this.updateAllRunningTimes(); }, 1000);
    }

    stopTimer() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    updateAllRunningTimes() {
        const rows = this.querySelectorAll('.series-row');
        const groupSeries = this.getGroupSeries();
        let activeFound = false;

        rows.forEach((row, index) => {
            const series = groupSeries[index];
            if (series && chronosDB.isChrono(series) && chronosDB.isRunning(series)) {
                activeFound = true;
                const timeDisplay = row.querySelector('.running-time');
                if (timeDisplay) {
                    timeDisplay.textContent = getRunningTime(series);
                }
            }
        });

        if (!activeFound) this.stopTimer();
    }

    getGroupSeries() {
        // Now using internally fetched series
        const source = this.filteredSeries.length > 0 ? this.filteredSeries : this.series;
        return source.filter(s => s.group === this.group?.name);
    }

    formatSummaryDisplay(summaryText) {
        if (!summaryText) return '';
        
        const parts = summaryText.split(': ');
        if (parts.length >= 2) {
            const label = parts[0];
            const value = parts.slice(1).join(': ');
            
            return `
                <div class="flex items-baseline">
                    <span class="text-[11px] font-black text-indigo-600 truncate dark:text-indigo-400">
                        ${value}
                    </span>
                    <span class="text-[9px] font-bold text-slate-400 uppercase ml-1.5 dark:text-slate-500">
                        ${label}
                    </span>
                </div>
            `;
        } else {
            return `
                <div class="flex items-baseline">
                    <span class="text-[11px] font-black text-indigo-600 truncate dark:text-indigo-400">
                        ${summaryText}
                    </span>
                </div>
            `;
        }
    }

    render() {
        if (!this.group) return;

        const groupSeries = this.getGroupSeries();
        if (groupSeries.length === 0) {
            this.style.display = 'none';
            this.stopTimer();
            return;
        }
        
        this.style.display = 'block';

        this.innerHTML = `
            <style>
                :host { display: block; }
                .running-indicator { animation: pulse 2s infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .summary-container { display: flex; flex-direction: column; gap: 1px; }
                .series-row:hover { background-color: ${this.group.color}40; }
            </style>
            <div id="group-card" class="rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md" 
                 style="border-color: ${this.group.color}40;background-color: ${this.group.color}12;">
                
                <div class="px-3 pt-1 border-b flex justify-between items-center">
                    <span class="text-[10px] font-bold uppercase tracking-widest truncate" 
                          style="color: ${this.group.color}">${this.group.name}</span>
                </div>

                <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
                    ${groupSeries.map(series => `
                        <div class="series-row px-3 py-1 dark:hover:bg-slate-700/50 cursor-pointer flex items-center justify-between transition-colors">
                            <div class="flex flex-col min-w-0 flex-1">
                                <div class="font-bold text-sm text-slate-800 truncate dark:text-slate-100 mb-0.5">${series.name}</div>
                                
                                <div class="flex flex-col min-h-[16px]">
                                    ${chronosDB.isChrono(series) && chronosDB.isRunning(series) ? `
                                        <div class="flex items-baseline running-indicator">
                                            <span class="text-[11px] font-black text-red-600 dark:text-red-400 running-time">
                                                ${getRunningTime(series)}
                                            </span>
                                            <span class="text-[9px] font-bold text-red-400 uppercase ml-1.5 dark:text-red-300">Running</span>
                                        </div>
                                    ` : `
                                        <div class="summary-container">
                                            ${series.summaries && series.summaries.length > 0 ? 
                                                series.summaries.map(s => this.formatSummaryDisplay(s)).join('') : 
                                                `<span class="text-[9px] text-slate-300 italic dark:text-slate-600">No data</span>`
                                            }
                                        </div>
                                    `}
                                </div>
                            </div>

                            <button class="ml-3 p-2 rounded-lg transition-colors ${this.getButtonClasses(series)}">
                                ${this.getButtonContent(series)}
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.querySelectorAll('.series-row').forEach((row, index) => {
            const series = groupSeries[index];
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.eventSend('series-click', series);
                }
            });

            row.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleQuickAdd(series);
            });
        });
    }

    getButtonContent(series) {
        if (chronosDB.isChrono(series) && chronosDB.isRunning(series)) {
            return '<i class="fa-solid fa-circle-stop text-base"></i>';
        }
        const action = series.config?.quickAddAction || 'manual';
        switch(action) {
            case 'increment': return '<span class="text-sm font-black">+1</span>';
            case 'chronometer': return '<i class="fa-solid fa-play text-base"></i>';
            case 'currentTime': return '<i class="fa-solid fa-clock text-base"></i>';
            default: return '<i class="fa-solid fa-plus text-base"></i>';
        }
    }

    getButtonClasses(series) {
        if (chronosDB.isChrono(series) && chronosDB.isRunning(series)) {
            return 'bg-red-50 text-red-600 animate-pulse dark:bg-red-900/20';
        }
        return 'text-indigo-600';
    }
}

customElements.define('group-card', GroupCard);