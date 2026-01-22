import chronosDB from './db.js';
import { formatDuration } from './utils.js';
import { calculateStats, filterByRange, calculateSeriesSummary } from './analytics.js';

class SeriesConfiguration extends HTMLElement {
    constructor() {
        super();
        this.seriesId = null;
        this.series = null;
        this.groups = [];
        this.entries = [];
    }

    static get observedAttributes() {
        return ['series-id'];
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'series-id' && newValue && newValue !== oldValue) {
            this.seriesId = newValue;
            await this.loadData();
            this.render();
        }
    }

    async loadData() {
        if (!this.seriesId) return;
        
        try {
            this.series = await chronosDB.getSeries(parseInt(this.seriesId));
            this.groups = await chronosDB.getAllGroups();
            this.entries = await chronosDB.getEntriesForSeries(parseInt(this.seriesId));
            this.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('Failed to load series data:', error);
        }
    }

    async updateSummaries() {
        const summariesContainer = this.querySelector('.summaries-container');
        if (!summariesContainer) return;

        const summaries = [];
        const summaryElements = summariesContainer.querySelectorAll('.summary-item');
        
        summaryElements.forEach(item => {
            const period = item.querySelector('.summary-period').value;
            const operation = item.querySelector('.summary-operation').value;
            const summary = { period, operation };
            
            if (period === 'custom') {
                const customDays = item.querySelector('.custom-days-input');
                summary.customDays = customDays ? parseInt(customDays.value) || 30 : 30;
            }
            
            summaries.push(summary);
        });

        this.series.config.summaries = summaries;
        await this.saveSeries();
        await this.updatePreview();
    }

    async updatePreview() {
        const previewContainer = this.querySelector('.summary-preview');
        if (!previewContainer || !this.series || !this.entries.length) return;

        const summaries = this.series.config?.summaries || [];
        
        if (summaries.length > 0 && Array.isArray(summaries)) {
            const previewHTML = summaries.map(summaryConfig => {
                const summary = (!this.series || !this.entries.length)?
                    'No Data' :
                    calculateSeriesSummary(
                        this.series, this.entries, formatDuration, summaryConfig
                    );
                return `<div class="flex items-baseline">
                    <span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">${summary}</span>
                </div>`;
            }).join('');
            
            previewContainer.innerHTML = previewHTML;
        } else {
            // Legacy format - use the series config
            if (this.series.config) {
                const legacySummary = calculateSeriesSummary(
                    this.series, 
                    this.entries, 
                    formatDuration, 
                    { 
                        period: 'all', 
                        operation: this.series.config.stat || 'mean' 
                    }
                );
                previewContainer.innerHTML = `<span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">${legacySummary || 'No Data'}</span>`;
            } else {
                const singleSummary = calculateSeriesSummary(
                    this.series, 
                    this.entries, 
                    formatDuration, 
                    { period: 'all', operation: 'mean' }
                );
                previewContainer.innerHTML = `<span class="text-sm font-black text-indigo-600 truncate dark:text-indigo-400">${singleSummary || 'No Data'}</span>`;
            }
        }
    }

    async saveSeries() {
        if (!this.series) return;
        await chronosDB.saveSeries(this.series);
        // Dispatch event to notify parent of changes
        this.dispatchEvent(new CustomEvent('series-updated', {
            detail: { seriesId: this.seriesId },
            bubbles: true
        }));
    }

    render() {
        if (!this.series) {
            this.innerHTML = '<div class="p-6 text-slate-500">Loading...</div>';
            return;
        }

        const summaries = this.series.config?.summaries || [];
        
        this.innerHTML = `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                <div class="max-w-4xl space-y-8">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">Configuration</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider dark:text-slate-500">Group</label>
                            <select class="group-select w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                <option value="">No Group</option>
                                ${this.groups.map(g => `
                                    <option value="${g.name}" ${g.name === this.series.group ? 'selected' : ''}>
                                        ${g.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="space-y-6">
                            <div class="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                <i class="fa-solid fa-calculator text-indigo-500 text-xs"></i>
                                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Dashboard Summary</h4>
                            </div>

                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider dark:text-slate-500">Summary Configuration</label>
                                <div class="space-y-3 summaries-container">
                                    ${summaries.map((summary, index) => `
                                        <div class="summary-item flex gap-2 items-center">
                                            <select class="summary-period text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                                <option value="all" ${summary.period === 'all' ? 'selected' : ''}>All Data</option>
                                                <option value="today" ${summary.period === 'today' ? 'selected' : ''}>Today</option>
                                                <option value="week" ${summary.period === 'week' ? 'selected' : ''}>Current Week</option>
                                                <option value="month" ${summary.period === 'month' ? 'selected' : ''}>Current Month</option>
                                                <option value="quarter" ${summary.period === 'quarter' ? 'selected' : ''}>Current Quarter</option>
                                                <option value="year" ${summary.period === 'year' ? 'selected' : ''}>Current Year</option>
                                                <option value="custom" ${summary.period === 'custom' ? 'selected' : ''}>Custom Days</option>
                                            </select>
                                            
                                            <select class="summary-operation text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                                <option value="mean" ${summary.operation === 'mean' ? 'selected' : ''}>Mean</option>
                                                <option value="dayMean" ${summary.operation === 'dayMean' ? 'selected' : ''}>Daily Avg</option>
                                                <option value="sum" ${summary.operation === 'sum' ? 'selected' : ''}>Sum</option>
                                                <option value="count" ${summary.operation === 'count' ? 'selected' : ''}>Count</option>
                                                <option value="min" ${summary.operation === 'min' ? 'selected' : ''}>Min</option>
                                                <option value="q1" ${summary.operation === 'q1' ? 'selected' : ''}>Q1</option>
                                                <option value="median" ${summary.operation === 'median' ? 'selected' : ''}>Median</option>
                                                <option value="q3" ${summary.operation === 'q3' ? 'selected' : ''}>Q3</option>
                                                <option value="max" ${summary.operation === 'max' ? 'selected' : ''}>Max</option>
                                                <option value="first" ${summary.operation === 'first' ? 'selected' : ''}>First</option>
                                                <option value="last" ${summary.operation === 'last' ? 'selected' : ''}>Last</option>
                                            </select>
                                            
                                            ${summary.period === 'custom' ? `
                                                <div class="flex items-center space-x-1">
                                                    <input type="number" 
                                                           value="${summary.customDays || 30}"
                                                           min="1"
                                                           class="custom-days-input w-16 text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                                    <span class="text-[10px] text-slate-400 dark:text-slate-500">days</span>
                                                </div>
                                            ` : ''}
                                            
                                            <button class="delete-summary p-1 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400">
                                                <i class="fa-solid fa-trash text-xs"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                                
                                <button class="add-summary text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center space-x-1">
                                    <i class="fa-solid fa-plus"></i>
                                    <span>Add Summary</span>
                                </button>
                            </div>

                            <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex flex-col dark:bg-indigo-900/30 dark:border-indigo-800">
                                <span class="text-[8px] font-black text-indigo-400 uppercase tracking-tighter dark:text-indigo-300 mb-1">Preview</span>
                                <div class="summary-preview space-y-1">
                                    <!-- Preview will be populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div class="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                <i class="fa-solid fa-bolt text-indigo-500 text-xs"></i>
                                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Button Behavior</h4>
                            </div>

                            <div>
                                <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider dark:text-slate-500">Quick Add (+) Action</label>
                                <select class="quick-add-action w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                    <option value="manual" ${this.series.config?.quickAddAction === 'manual' ? 'selected' : ''}>Manual Entry Modal</option>
                                    ${this.series.type === 'number' ? `
                                        <option value="increment" ${this.series.config?.quickAddAction === 'increment' ? 'selected' : ''}>One-Click (+1)</option>
                                    ` : ''}
                                    ${this.series.type === 'time' ? `
                                        <optgroup label="Time Shortcuts">
                                            <option value="currentTime" ${this.series.config?.quickAddAction === 'currentTime' ? 'selected' : ''}>Stamp Current Time</option>
                                            <option value="chronometer" ${this.series.config?.quickAddAction === 'chronometer' ? 'selected' : ''}>Start/Stop Chronometer</option>
                                        </optgroup>
                                    ` : ''}
                                </select>
                            </div>

                            <div class="bg-slate-50 border border-slate-100 p-3 rounded-xl dark:bg-slate-700 dark:border-slate-600">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1 dark:text-slate-500">How it works</p>
                                <p class="text-[11px] text-slate-500 leading-relaxed italic dark:text-slate-400">
                                    Sets the action triggered by the <span class="font-bold text-indigo-600 dark:text-indigo-400">plus (+)</span> icon on your dashboard for this series.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.updatePreview();
    }

    setupEventListeners() {
        // Group change
        const groupSelect = this.querySelector('.group-select');
        if (groupSelect) {
            groupSelect.addEventListener('change', async (e) => {
                this.series.group = e.target.value;
                await this.saveSeries();
            });
        }

        // Quick add action change
        const quickAddSelect = this.querySelector('.quick-add-action');
        if (quickAddSelect) {
            quickAddSelect.addEventListener('change', async (e) => {
                if (!this.series.config) this.series.config = {};
                this.series.config.quickAddAction = e.target.value;
                await this.saveSeries();
            });
        }

        // Summary configuration
        const summariesContainer = this.querySelector('.summaries-container');
        if (summariesContainer) {
            // Handle period/operation changes
            summariesContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('summary-period') || 
                    e.target.classList.contains('summary-operation') ||
                    e.target.classList.contains('custom-days-input')) {
                    this.updateSummaries();
                }
            });

            // Handle delete
            summariesContainer.addEventListener('click', (e) => {
                if (e.target.closest('.delete-summary')) {
                    const item = e.target.closest('.summary-item');
                    if (item && summariesContainer.querySelectorAll('.summary-item').length > 1) {
                        item.remove();
                        this.updateSummaries();
                    }
                }
            });
        }

        // Add new summary
        const addSummaryBtn = this.querySelector('.add-summary');
        if (addSummaryBtn) {
            addSummaryBtn.addEventListener('click', () => {
                const summariesContainer = this.querySelector('.summaries-container');
                if (summariesContainer) {
                    const newItem = document.createElement('div');
                    newItem.className = 'summary-item flex gap-2 items-center';
                    newItem.innerHTML = `
                        <select class="summary-period text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                            <option value="all">All Data</option>
                            <option value="today">Today</option>
                            <option value="week">Current Week</option>
                            <option value="month">Current Month</option>
                            <option value="quarter">Current Quarter</option>
                            <option value="year">Current Year</option>
                            <option value="custom">Custom Days</option>
                        </select>
                        
                        <select class="summary-operation text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                            <option value="mean">Mean</option>
                            <option value="dayMean">Daily Avg</option>
                            <option value="sum">Sum</option>
                            <option value="count">Count</option>
                            <option value="min">Min</option>
                            <option value="q1">Q1</option>
                            <option value="median">Median</option>
                            <option value="q3">Q3</option>
                            <option value="max">Max</option>
                            <option value="first">First</option>
                            <option value="last">Last</option>
                        </select>
                        
                        <button class="delete-summary p-1 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    `;
                    summariesContainer.appendChild(newItem);
                    this.updateSummaries();
                }
            });
        }
    }
}

customElements.define('series-configuration', SeriesConfiguration);