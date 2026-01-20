import { formatDuration, getFormattedISO, getRunningTime } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

export class GroupCard extends HTMLElement {
    constructor() {
        super();
        this.group = null;
        this.series = [];
        this.now = Date.now();
        this.updateInterval = null;
        this.filteredSeries = [];
    }

    static get observedAttributes() {
        return ['group', 'series', 'filtered'];
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'group') {
            this.group = newValue ? JSON.parse(newValue) : null;
        } else if (name === 'series') {
            this.series = newValue ? JSON.parse(newValue) : [];
        } else if (name === 'filtered') {
            this.filteredSeries = newValue ? JSON.parse(newValue) : [];
        }
        
        // Refresh summaries whenever data changes
        await this.refreshAllSummaries();
        this.render();
        this.manageTimer(); 
    }

    async connectedCallback() {
        await this.refreshAllSummaries();
        this.render();
        this.manageTimer();
    }

    disconnectedCallback() {
        this.stopTimer();
    }

    /**
     * ANALYTICS LOGIC
     * Fetches entries for each series in the group and calculates the summary strings
     */
    async refreshAllSummaries() {
        const groupSeries = this.getGroupSeries();
        for (const series of groupSeries) {
            const entries = await chronosDB.getEntriesForSeries(series.id);
            
            if (series.config?.summaries && Array.isArray(series.config.summaries)) {
                // Map through multiple summary configurations if they exist
                const summaries = series.config.summaries.map(summaryConfig => {
                    return calculateSeriesSummary(
                        series,
                        entries,
                        formatDuration.bind(this),
                        summaryConfig
                    );
                }).filter(summary => summary && summary.trim() !== '');
                
                // Store as an array for the renderer to handle multiple lines
                series.summaries = summaries;
            } else {
                // Fallback to single summary
                const singleSummary = calculateSeriesSummary(
                    series,
                    entries,
                    formatDuration.bind(this)
                );
                series.summaries = singleSummary ? [singleSummary] : [];
            }
        }
    }

    /**
     * DATABASE HANDLERS
     */
    async handleQuickAdd(series) {
        const action = series.config?.quickAddAction || 'manual';
        
        if (action === 'increment' && series.type === 'number') {
            await this.handleIncrement(series);
        } else if (action === 'chronometer' && series.type === 'time') {
            await this.handleChronometer(series);
        } else if (action === 'currentTime' && series.type === 'time') {
            await this.handleCurrentTime(series);
        } else {
            this.dispatchEvent(new CustomEvent('add-entry-click', {
                detail: { series },
                bubbles: true,
                composed: true
            }));
        }
    }

    async handleIncrement(series) {
        const todayStr = new Date().toISOString().split('T')[0];
        const entries = await chronosDB.getEntriesForSeries(series.id);
        const todayEntry = entries.find(ent => ent.timestamp.startsWith(todayStr));
        
        if (todayEntry) {
            todayEntry.value = (todayEntry.value || 0) + 1;
            await chronosDB.saveEntry(todayEntry);
        } else {
            await chronosDB.saveEntry({
                timestamp: getFormattedISO(),
                value: 1,
                notes: '',
                seriesId: series.id
            });
        }
        
        await this.refreshAllSummaries();
        this.render();
        this.notifyUpdate(series.id, true);
    }

    async handleChronometer(series) {
        await chronosDB.toggle(series);
        await this.refreshAllSummaries();
        this.render();
        this.notifyUpdate(series.id, true);
        this.manageTimer();
    }

    async handleCurrentTime(series) {
        const now = new Date();
        const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        
        await chronosDB.saveEntry({
            timestamp: getFormattedISO(),
            value: secondsSinceMidnight,
            notes: '',
            seriesId: series.id
        });
        
        await this.refreshAllSummaries();
        this.render();
        this.notifyUpdate(series.id, true);
    }

    notifyUpdate(seriesId, seriesChanged = false) {
        this.dispatchEvent(new CustomEvent('entry-created', {
            detail: { seriesId },
            bubbles: true,
            composed: true
        }));

        if (seriesChanged) {
            this.dispatchEvent(new CustomEvent('series-updated', {
                detail: { seriesId },
                bubbles: true,
                composed: true
            }));
        }
    }

    /**
     * TIMER LOGIC
     */
    manageTimer() {
        const groupSeries = this.getGroupSeries();
        const hasActiveChronometer = groupSeries.some(s => chronosDB.isChrono(s) && chronosDB.isRunning(s) );

        if (hasActiveChronometer) {
            this.startTimer();
        } else {
            this.stopTimer();
        }
    }

    startTimer() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => {
            this.now = Date.now();
            this.updateAllRunningTimes();
        }, 1000);
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
                    this.dispatchEvent(new CustomEvent('series-click', {
                        detail: { series },
                        bubbles: true,
                        composed: true
                    }));
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