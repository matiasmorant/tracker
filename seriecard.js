import { formatDuration, secondsToDHMS, getFormattedISO, getRunningTime } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import chronosDB from './db.js';

export class SerieCard extends HTMLElement {
    constructor() {
        super();
        this.series = null;
        this.group = null;
        this.now = Date.now();
        this.updateInterval = null;
        this.entries = [];
    }

    static get observedAttributes() {
        return ['series', 'group'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'series') {
            this.series = newValue ? JSON.parse(newValue) : null;
            if (this.series) {
                this.loadEntries();
            }
        } else if (name === 'group') {
            this.group = newValue ? JSON.parse(newValue) : null;
        }
        this.render();
    }

    async connectedCallback() {
        this.render();
        // Start interval for updating running time display
        this.updateInterval = setInterval(() => {
            this.now = Date.now();
            if (this.series?.startTime && this.series.config?.quickAddAction === 'chronometer') {
                this.updateRunningTime();
            }
        }, 1000);
        
        if (this.series) {
            await this.loadEntries();
        }
    }

    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
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
            }
            return;
        }
        
        this.series.summaryDisplay = calculateSeriesSummary(
            this.series,
            this.entries,
            formatDuration.bind(this)
        );
        
        // Re-render the component to show updated summary
        this.render();
    }

    updateRunningTime() {
        const runningTimeElement = this.querySelector('.running-time');
        if (runningTimeElement && this.series?.startTime) {
            const elapsedMs = Math.max(0, this.now - new Date(this.series.startTime).getTime());
            runningTimeElement.textContent = formatDuration(Math.floor(elapsedMs / 1000));
        }
    }

    async handleAddEntryClick(e) {
        e.stopPropagation();
        
        const action = this.series.config?.quickAddAction || 'manual';
        
        // Handle quick actions directly
        if (action === 'increment' && this.series.type === 'number') {
            await this.handleIncrement();
            return;
        }
        
        if (action === 'chronometer' && this.series.type === 'time') {
            await this.handleChronometer();
            return;
        }
        
        if (action === 'currentTime' && this.series.type === 'time') {
            await this.handleCurrentTime();
            return;
        }
        
        // For manual action, emit event for parent to handle
        this.dispatchEvent(new CustomEvent('add-entry-click', {
            detail: { series: this.series },
            bubbles: true,
            composed: true
        }));
    }

    async handleIncrement() {
        const todayStr = new Date().toISOString().split('T')[0];
        const entries = await chronosDB.getEntriesForSeries(this.series.id);
        const todayEntry = entries.find(ent => ent.timestamp.startsWith(todayStr));
        
        if (todayEntry) {
            // Update existing entry
            todayEntry.value = (todayEntry.value || 0) + 1;
            await chronosDB.saveEntry(todayEntry);
        } else {
            // Create new entry
            await chronosDB.saveEntry({
                timestamp: getFormattedISO(),
                value: 1,
                notes: '',
                seriesId: this.series.id
            });
        }
        
        // Reload entries and recalculate summary
        await this.loadEntries();
        
        // Notify parent
        this.dispatchEvent(new CustomEvent('entry-created', {
            detail: { seriesId: this.series.id },
            bubbles: true,
            composed: true
        }));
    }

    async handleChronometer() {
        const now = new Date();
        
        if (!this.series.startTime) {
            // Start chronometer
            this.series.startTime = now.toISOString();
            await chronosDB.saveSeries(this.series);
            
            // Update running time display
            this.render();
            
            // Notify parent
            this.dispatchEvent(new CustomEvent('series-updated', {
                detail: { series: this.series },
                bubbles: true,
                composed: true
            }));
        } else {
            // Stop chronometer and create entry
            const start = new Date(this.series.startTime);
            const elapsedSeconds = Math.floor((now - start) / 1000);
            this.series.startTime = null;
            
            // Create entry
            await chronosDB.saveEntry({
                timestamp: getFormattedISO(now),
                value: elapsedSeconds,
                notes: `Elapsed: ${formatDuration(elapsedSeconds)}`,
                seriesId: this.series.id
            });
            
            // Save series without startTime
            await chronosDB.saveSeries(this.series);
            
            // Reload entries and recalculate summary
            await this.loadEntries();
            
            // Notify parent of both updates
            this.dispatchEvent(new CustomEvent('series-updated', {
                detail: { series: this.series },
                bubbles: true,
                composed: true
            }));
            
            this.dispatchEvent(new CustomEvent('entry-created', {
                detail: { seriesId: this.series.id },
                bubbles: true,
                composed: true
            }));
        }
    }

    async handleCurrentTime() {
        const now = new Date();
        const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        
        await chronosDB.saveEntry({
            timestamp: getFormattedISO(),
            value: secondsSinceMidnight,
            notes: '',
            seriesId: this.series.id
        });
        
        // Reload entries and recalculate summary
        await this.loadEntries();
        
        this.dispatchEvent(new CustomEvent('entry-created', {
            detail: { seriesId: this.series.id },
            bubbles: true,
            composed: true
        }));
    }

    handleCardClick() {
        this.dispatchEvent(new CustomEvent('series-click', {
            detail: { series: this.series },
            bubbles: true,
            composed: true
        }));
    }

    getButtonContent() {
        if (this.series.startTime && this.series.config?.quickAddAction === 'chronometer') {
            return '<i class="fa-solid fa-circle-stop text-lg"></i>';
        }
        
        const action = this.series.config?.quickAddAction || 'manual';
        
        switch(action) {
            case 'increment':
                return '<span class="text-sm font-black">+1</span>';
            case 'chronometer':
                return '<i class="fa-solid fa-play text-lg"></i>';
            case 'currentTime':
                return '<i class="fa-solid fa-clock text-lg"></i>';
            default:
                return '<i class="fa-solid fa-plus text-lg"></i>';
        }
    }

    getButtonClasses() {
        if (this.series.startTime && this.series.config?.quickAddAction === 'chronometer') {
            return 'bg-red-100 text-red-600 animate-pulse dark:bg-red-900/30 dark:text-red-400';
        }
        return 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700';
    }

    getCardClasses() {
        let baseClasses = 'px-3 py-0 rounded-xl border shadow-sm transition-all cursor-pointer group flex flex-col justify-center min-h-[88px] max-h-[100px] relative';
        
        if (this.group) {
            return `${baseClasses} hover:shadow-md`;
        } else {
            return `${baseClasses} bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md dark:bg-slate-800 dark:border-slate-700 dark:hover:border-indigo-500`;
        }
    }

    getCardStyle() {
        if (this.group) {
            return `background-color: ${this.group.color}12; border-color: ${this.group.color}40;`;
        }
        return '';
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

                    <div class="mt-1 flex items-baseline">
                        ${this.series.startTime && this.series.config?.quickAddAction === 'chronometer' ? `
                            <div class="flex items-baseline animate-pulse">
                                <span class="running-time text-sm font-black text-red-600 truncate dark:text-red-400">
                                    ${getRunningTime(this.series)}
                                </span>
                                <span class="text-[10px] font-bold text-red-400 uppercase ml-1.5 dark:text-red-300">
                                    Running
                                </span>
                            </div>
                        ` : `
                            <div class="flex items-baseline">
                                ${this.series.summaryDisplay ? `
                                    <div class="flex items-baseline">
                                        <span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">
                                            ${this.series.summaryDisplay.split(': ')[1] || ''}
                                        </span>
                                        <span class="text-[10px] font-bold text-slate-400 uppercase ml-1.5 dark:text-slate-500">
                                            ${this.series.summaryDisplay.split(': ')[0] || ''}
                                        </span>
                                    </div>
                                ` : `
                                    <span class="text-[10px] text-slate-300 italic dark:text-slate-600">No data</span>
                                `}
                            </div>
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
            if (e.target !== button && !button.contains(e.target)) {
                this.handleCardClick();
            }
        });
        
        button.addEventListener('click', (e) => this.handleAddEntryClick(e));
        
        // Update running time if needed
        if (this.series?.startTime && this.series.config?.quickAddAction === 'chronometer') {
            this.updateRunningTime();
        }
    }
}

customElements.define('serie-card', SerieCard);