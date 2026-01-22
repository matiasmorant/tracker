import { formatDuration, secondsToDHMS, getFormattedISO, getRunningTime, elapsedSeconds } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

export class SerieCard extends HTMLElement {
    constructor() {
        super();
        this.series = null;
        this.group = null;
        this.updateInterval = null;
        this.entries = [];
        this.summaries = [];
    }

    static get observedAttributes() {
        return ['series', 'group'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'series') {
            this.series = newValue ? JSON.parse(newValue) : null;
            if (this.series) this.loadEntries();
        } else if (name === 'group') {
            this.group = newValue ? JSON.parse(newValue) : null;
        }
        this.render();
    }

    async connectedCallback() {
        this.render();
        this.updateInterval = setInterval(() => {
            if (chronosDB.isRunning(this.series)) this.updateRunningTime();
        }, 1000);
        
        if (this.series) { await this.loadEntries(); }
    }

    disconnectedCallback() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    }

    async loadEntries() {
        if (!this.series || !this.series.id) return;
        
        this.entries = await chronosDB.getEntriesForSeries(this.series.id);
        this.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.recalculateSummaryDisplay();
    }

    recalculateSummaryDisplay() {
        if (!this.series || !this.entries.length || !this.series.config) {
            if (this.series) {
                this.series.summaryDisplay = '';
                this.summaries = []; // Clear summaries array
            }
            return;
        }
        
        // Calculate summaries - if multiple summaries are defined in config
        if (this.series.config.summaries && Array.isArray(this.series.config.summaries)) {
            this.summaries = this.series.config.summaries.map(summaryConfig => {
                return calculateSeriesSummary(
                    this.series,
                    this.entries,
                    formatDuration.bind(this),
                    summaryConfig
                );
            }).filter(summary => summary && summary.trim() !== '');
        } else {
            // Fallback to single summary for backward compatibility
            const singleSummary = calculateSeriesSummary(
                this.series,
                this.entries,
                formatDuration.bind(this)
            );
            this.summaries = singleSummary ? [singleSummary] : [];
        }
        
        this.render();
    }

    updateRunningTime() {
        const runningTimeElement = this.querySelector('.running-time');
        if (runningTimeElement && chronosDB.isRunning(this.series)) {
            runningTimeElement.textContent = formatDuration(elapsedSeconds(this.series));
        }
    }

    async handleAddEntryClick(e) {
        e.stopPropagation();
        
        await chronosDB.quickAction(this.series)

        const action = this.series.config?.quickAddAction || 'manual';
        
        if (action === 'increment') { await this.handleIncrement(); return; }
        if (action === 'chronometer') { await this.handleChronometer(); return; }
        if (action === 'currentTime') { await this.handleCurrentTime(); return; }

        this.eventSend('add-entry-click');
    }

    async handleIncrement() {
        await this.loadEntries();
        this.eventSend('entry-created');
    }

    async handleChronometer() {
        if (chronosDB.isRunning(this.series)) {
            this.render();
            this.eventSend('series-updated');
        } else {
            await this.loadEntries();
            this.eventSend('series-updated');
            this.eventSend('entry-created');
        }
    }

    async handleCurrentTime() {
        await this.loadEntries();
        this.eventSend('entry-created');
    }

    eventSend(name) { this.dispatchEvent(new CustomEvent(name, {detail: {series: this.series}, bubbles: true, composed: true})); }

    getButtonContent() {
        return chronosDB.isRunning(this.series)?
        '<i class="fa-solid fa-circle-stop text-lg"></i>' :
        {
            'increment': '<span class="text-sm font-black">+1</span>',
            'chronometer': '<i class="fa-solid fa-play text-lg"></i>',
            'currentTime': '<i class="fa-solid fa-clock text-lg"></i>',
            'manual': '<i class="fa-solid fa-plus text-lg"></i>'
        }[this.series.config?.quickAddAction || 'manual'];
    }

    getButtonClasses() {
        return chronosDB.isRunning(this.series)
            ? 'bg-red-100 text-red-600 animate-pulse dark:bg-red-900/30 dark:text-red-400'
            : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700';
        }

    getCardClasses() {
        let baseClasses = 'px-3 py-0 rounded-xl border shadow-sm transition-all cursor-pointer group flex flex-col justify-center min-h-[88px] max-h-[120px] relative';
        return `${baseClasses} hover:shadow-md ${this.group ?'':'bg-white border-slate-200 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-500'}`;
    }

    getCardStyle() { return this.group? `background-color: ${this.group.color}12; border-color: ${this.group.color}40;`:''; }

    // Helper method to format individual summary display
    formatSummaryDisplay(summaryText) {
        if (!summaryText) return '';
        
        // Check if summary follows "Label: Value" format
        const parts = summaryText.split(': ');
        if (parts.length >= 2) {
            const label = parts[0];
            const value = parts.slice(1).join(': '); // In case value contains colons
            
            return `
                <div class="flex items-baseline">
                    <span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">
                        ${value}
                    </span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase ml-1.5 dark:text-slate-500">
                        ${label}
                    </span>
                </div>
            `;
        } else {
            // For simple summary text without label
            return `
                <div class="flex items-baseline">
                    <span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">
                        ${summaryText}
                    </span>
                </div>
            `;
        }
    }

    render() {
        if (!this.series) return;

        this.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                /* Import Font Awesome */
                @import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css");
                
                .card {
                    transition: all 0.2s;
                }
                .running-time {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.5;
                    }
                }
                .add-button {
                    transition: background-color 0.2s;
                }
                .summary-column {
                    display: flex;
                    flex-direction: column;
                    gap: 2px; /* Small gap between summary items */
                    margin-top: 2px;
                    margin-bottom: 2px;
                }
            </style>
            <div id="card" class="${this.getCardClasses()}" style="${this.getCardStyle()}">
                <div class="flex flex-col justify-center min-w-0 flex-1">
                    <div class="mb-1">
                        <div class="font-bold text-slate-800 truncate leading-tight dark:text-slate-100">
                            ${this.series.name}
                        </div>
                        ${this.group ? `
                            <div class="text-[10px] font-bold uppercase tracking-tight truncate" 
                                 style="color: ${this.group.color || '#94a3b8'}">
                                ${this.group.name}
                            </div>
                        ` : ''}
                    </div>

                    <div class="mt-1">
                        ${chronosDB.isRunning(this.series) ? `
                            <div class="flex items-baseline animate-pulse">
                                <span class="running-time text-sm font-black text-red-600 truncate dark:text-red-400">
                                    ${getRunningTime(this.series)}
                                </span>
                                <span class="text-[10px] font-bold text-red-400 uppercase ml-1.5 dark:text-red-300">
                                    Running
                                </span>
                            </div>
                        ` : `
                            ${this.summaries.length > 0 ? `
                                <div class="summary-column">
                                    ${this.summaries.map(summary => this.formatSummaryDisplay(summary)).join('')}
                                </div>
                            ` : `
                                <span class="text-[10px] text-slate-300 italic dark:text-slate-600">No data</span>
                            `}
                        `}
                        <button class="absolute bottom-2 right-2 p-1.5 rounded-full transition-colors ${this.getButtonClasses()}">
                            ${this.getButtonContent()}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        const card = this.querySelector('#card');
        const button = this.querySelector('button');
        
        card.addEventListener('click', (e) => {
            if (e.target !== button && !button.contains(e.target)) this.eventSend('series-click');
        });
        
        button.addEventListener('click', (e) => this.handleAddEntryClick(e));
        if (chronosDB.isRunning(this.series)) this.updateRunningTime();
    }
}

customElements.define('serie-card', SerieCard);