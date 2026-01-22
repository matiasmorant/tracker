import chronosDB from './db.js';

export class SeriesChartConfig extends HTMLElement {
  constructor() {
    super();
    this.seriesId = null;
    this.series = null;
    this.allGroups = [];
    this.chartSettings = {};
    this.analysisSelection = [];
  }

  static get observedAttributes() {
    return ['series-id'];
  }

  async connectedCallback() {
    this.seriesId = this.getAttribute('series-id');
    if (this.seriesId) {
      await this.loadData();
      this.render();
    }
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'series-id' && newValue !== oldValue && newValue) {
      this.seriesId = newValue;
      await this.loadData();
      this.render();
    }
  }

  async loadData() {
    try {
      this.series = await chronosDB.getSeries(parseInt(this.seriesId));
      this.allGroups = await chronosDB.getAllGroups();
      this.allSeries = await chronosDB.getAllSeries();

      // Initialize chart settings and analysis selection
      if (this.series.config) {
        this.chartSettings = this.series.config.chartSettings || {};
        this.analysisSelection = this.series.config.analysisSelection || [];
      } else {
        this.chartSettings = {};
        this.analysisSelection = [];
      }
    } catch (err) {
      console.error('Failed to load series config data:', err);
    }
  }

  async saveSeries() {
    if (!this.series) return;
    
    // Update the series configuration
    this.series.config = {
      ...this.series.config,
      analysisSelection: [...this.analysisSelection],
      chartSettings: { ...this.chartSettings }
    };
    
    await chronosDB.saveSeries(this.series);

    this.render();
    
    // Dispatch event to notify parent component
    this.dispatchEvent(new CustomEvent('config-updated', {
      bubbles: true,
      detail: { series: this.series }
    }));
  }

  handleAnalysisChange(event) {
    this.analysisSelection = event.detail.selection;
    this.saveSeries();
  }

  handlePeriodChange(event) {
    this.chartSettings.period = event.target.value;
    this.saveSeries();
  }

  handleRunningMetricChange(event) {
    this.chartSettings.runningMetric = event.target.value;
    this.saveSeries();
  }

  handleWindowChange(event) {
    this.chartSettings.window = parseInt(event.target.value) || 7;
    this.saveSeries();
  }

  handleRangeChange(event) {
    this.chartSettings.range = event.target.value;
    this.saveSeries();
  }

  handleCustomDaysChange(event) {
    this.chartSettings.customDays = parseInt(event.target.value) || 30;
    this.saveSeries();
  }

  handleCompareChange(event) {
    this.chartSettings.compareSeriesIds = event.detail.selection;
    this.saveSeries();
  }

  render() {
    if (!this.series) {
      this.innerHTML = '<div class="p-4 text-slate-500">Loading configuration...</div>';
      return;
    }

    const otherSeries = (this.allSeries || []).filter(s => s.id !== this.series.id);

    // Default metrics for analysis selection
    const metrics = [
      { id: 'mean', label: 'Mean', color: '#4f46e5' },
      { id: 'dayMean', label: 'Day Mean', color: '#10b981' },
      { id: 'sum', label: 'Sum', color: '#10b981' },
      { id: 'count', label: 'Count', color: '#f59e0b' },
      { id: 'min', label: 'Min', color: '#ef4444' },
      { id: 'q1', label: 'Q1', color: '#8b5cf6' },
      { id: 'median', label: 'Median', color: '#ec4899' },
      { id: 'q3', label: 'Q3', color: '#06b6d4' },
      { id: 'max', label: 'Max', color: '#1e293b' },
      { id: 'first', label: 'First', color: '#6366f1' },
      { id: 'last', label: 'Last', color: '#6366f1' }
    ];

    // Default chart settings
    const defaultSettings = {
      period: 'none',
      logScale: false,
      runningMetric: '',
      window: 7,
      range: 'all',
      customDays: 30,
      compareSeriesIds: []
    };

    const settings = { ...defaultSettings, ...this.chartSettings };

    this.innerHTML = `
      <div id="configPanel" class="border-t border-slate-100 dark:border-slate-700">
        <div class="p-4">
          <div>
            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">Statistics</h3>

            ${metrics.length > 0 ? `
              <div class="flex flex-row gap-2 mt-2">
                <multi-select 
                  data-role="analysis-select"
                  items='${JSON.stringify(metrics.map(m => ({ id: m.id, label: m.label, color: m.color })))}'
                  selected-ids='${JSON.stringify(this.analysisSelection)}'
                  multi>
                </multi-select>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter dark:text-slate-500">Period Grouping</span>
                  <select data-setting="period" class="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                    <option value="none" ${settings.period === 'none' ? 'selected' : ''}>Raw Data</option>
                    <option value="day" ${settings.period === 'day' ? 'selected' : ''}>Day</option>
                    <option value="week" ${settings.period === 'week' ? 'selected' : ''}>Week</option>
                    <option value="month" ${settings.period === 'month' ? 'selected' : ''}>Month</option>
                    <option value="quarter" ${settings.period === 'quarter' ? 'selected' : ''}>Quarter</option>
                    <option value="year" ${settings.period === 'year' ? 'selected' : ''}>Year</option>
                  </select>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="flex flex-wrap items-center gap-4 my-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter dark:text-slate-500">Running Average/Stat</span>
              <div class="flex items-center space-x-2">
                <select data-setting="runningMetric" class="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                  <option value="" ${!settings.runningMetric ? 'selected' : ''}>None</option>
                  ${metrics.map(m => `
                    <option value="${m.id}" ${settings.runningMetric === m.id ? 'selected' : ''}>${m.label}</option>
                  `).join('')}
                </select>
                <input type="number" data-setting="window" value="${settings.window}" min="2" step="1" placeholder="Win" class="w-14 text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
              </div>
            </div>
          </div>

          <div class="flex flex-row gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 class="content-center text-[10px] font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">Time Range</h3>
            
            <div class="flex flex-row gap-3 items-start sm:items-center">
              <div class="relative max-w-xs">
                <select 
                  data-setting="range"
                  class="w-full pl-3 pr-10 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                >
                  <option value="all" ${settings.range === 'all' ? 'selected' : ''}>All Time</option>
                  <option value="day" ${settings.range === 'day' ? 'selected' : ''}>Day</option>
                  <option value="week" ${settings.range === 'week' ? 'selected' : ''}>Week</option>
                  <option value="month" ${settings.range === 'month' ? 'selected' : ''}>Month</option>
                  <option value="quarter" ${settings.range === 'quarter' ? 'selected' : ''}>Quarter</option>
                  <option value="year" ${settings.range === 'year' ? 'selected' : ''}>Year</option>
                  <option value="custom" ${settings.range === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                  <i class="fa-solid fa-chevron-down text-[10px]"></i>
                </div>
              </div>
      
              ${settings.range === 'custom' ? `
                <div class="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-200">
                  <input 
                    type="number" 
                    data-setting="customDays"
                    value="${settings.customDays}"
                    placeholder="Days"
                    class="w-16 px-2 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                  >
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Days</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="p-4 border-t border-slate-100 dark:border-slate-700">
            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500 mb-2">Compare with other series</h3>
            <div class="flex flex-row gap-2">
              <multi-select 
                class="flex-1"
                data-role="compare-select"
                items='${JSON.stringify(otherSeries.map(s => ({ id: s.id, label: s.name })))}'
                selected-ids='${JSON.stringify(settings.compareSeriesIds || [])}'
                multi>
              </multi-select>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Analysis selection
    const analysisSelect = this.querySelector('[data-role="analysis-select"]');
    if (analysisSelect) {
      analysisSelect.addEventListener('change', (e) => this.handleAnalysisChange(e));
    }

    // Period setting
    const periodSelect = this.querySelector('[data-setting="period"]');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => this.handlePeriodChange(e));
    }

    // Running metric
    const runningMetricSelect = this.querySelector('[data-setting="runningMetric"]');
    if (runningMetricSelect) {
      runningMetricSelect.addEventListener('change', (e) => this.handleRunningMetricChange(e));
    }

    // Window
    const windowInput = this.querySelector('[data-setting="window"]');
    if (windowInput) {
      windowInput.addEventListener('input', (e) => this.handleWindowChange(e));
    }

    // Range
    const rangeSelect = this.querySelector('[data-setting="range"]');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => this.handleRangeChange(e));
    }

    // Custom days
    const customDaysInput = this.querySelector('[data-setting="customDays"]');
    if (customDaysInput) {
      let timeout;
      customDaysInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.handleCustomDaysChange(e), 500);
      });
    }

    // Compare selection
    const compareSelect = this.querySelector('[data-role="compare-select"]');
    if (compareSelect) {
      compareSelect.addEventListener('change', (e) => this.handleCompareChange(e));
    }
  }
}

customElements.define('series-chart-config', SeriesChartConfig);