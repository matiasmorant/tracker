import { formatDuration } from './utils.js';
import { calculateStats, getPeriodData } from './analytics.js';
import chronosDB from './db.js';
import './series-chart-config.js';

export class SeriesChart extends HTMLElement {
  constructor() {
    super();
    this.seriesId = null;
    this.series = null;
    this.entries = [];
    this.allSeries = [];
    this.chartSettings = {
      period: 'none',
      logScale: false,
      runningMetric: '',
      window: 7,
      range: 'all',
      customDays: 30,
      compareSeriesIds: []
    };
    this.analysisSelection = ['mean', 'dayMean', 'count'];
    this.metrics = [
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
    this.chartConfigCollapsed = true;
    this.isDark = document.documentElement.classList.contains('dark');
  }

  static get observedAttributes() {
    return ['series-id'];
  }

  async connectedCallback() {
    this.seriesId = this.getAttribute('series-id');
    if (this.seriesId) {
      await this.loadData();
      this.render();
      this.updateChart();
    }

    // Listen for theme changes
    this.themeObserver = new MutationObserver(() => {
      const wasDark = this.isDark;
      this.isDark = document.documentElement.classList.contains('dark');
      if (wasDark !== this.isDark) {
        this.updateChart();
      }
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  disconnectedCallback() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'series-id' && newValue !== oldValue && newValue) {
      this.seriesId = newValue;
      await this.loadData();
      this.render();
      this.updateChart();
    }
  }

  async loadData() {
    try {
      this.series = await chronosDB.getSeries(parseInt(this.seriesId));
      this.entries = await chronosDB.getEntriesForSeries(parseInt(this.seriesId));
      this.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      this.allSeries = await chronosDB.getAllSeries();

      // Load saved settings
      if (this.series.config) {
        if (this.series.config.analysisSelection) {
          this.analysisSelection = [...this.series.config.analysisSelection];
        }
        if (this.series.config.chartSettings) {
          this.chartSettings = { ...this.chartSettings, ...this.series.config.chartSettings };
          if (!this.chartSettings.compareSeriesIds) {
            this.chartSettings.compareSeriesIds = [];
          }
        }
      }
    } catch (err) {
      console.error('Failed to load series data:', err);
    }
  }

  toggleCollapsed() {
    this.chartConfigCollapsed = !this.chartConfigCollapsed;
    const panel = this.querySelector('#configPanel');
    const chartContainer = this.querySelector('.transition-all');
    const toggleBtn = this.querySelector('[data-action="toggle-collapsed"] span');

    if (panel) panel.classList.toggle('hidden');
    if (chartContainer) {
      chartContainer.classList.toggle('h-96', !this.chartConfigCollapsed);
      chartContainer.classList.toggle('h-[calc(100vh-240px)]', this.chartConfigCollapsed);
    }
    if (toggleBtn) toggleBtn.textContent = this.chartConfigCollapsed ? 'Statistics' : 'Hide';
  }

  handleScaleClick() {
    this.chartSettings.logScale = !this.chartSettings.logScale;
    this.updateChart();
  }

  handleConfigUpdated(event) {
    // Update local state when config changes
    const updatedSeries = event.detail.series;
    if (updatedSeries.config) {
      if (updatedSeries.config.analysisSelection) {
        this.analysisSelection = [...updatedSeries.config.analysisSelection];
      }
      if (updatedSeries.config.chartSettings) {
        this.chartSettings = { ...this.chartSettings, ...updatedSeries.config.chartSettings };
      }
    }
    this.updateChart();
  }

  render() {
    if (!this.series) {
      this.innerHTML = '<div class="p-4 text-slate-500">Loading...</div>';
      return;
    }

    this.innerHTML = `
      <div class="flex-1 flex flex-col space-y-6">
        <div class="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700 overflow-hidden">
          <div class="flex-1 ${this.chartConfigCollapsed ? 'h-[calc(100vh-240px)]' : 'h-96'} transition-all duration-300 ease-in-out p-2">
            <chronos-chart
              id="seriesChart"
              style="width: 100%; height: 100%;">
            </chronos-chart>
          </div>

          <div class="px-4 py-0 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <button 
              data-action="toggle-collapsed"
              class="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center space-x-1"
            >
              <i class="fa-solid ${this.chartConfigCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>
              <span>${this.chartConfigCollapsed ? 'Statistics' : 'Hide'}</span>
            </button>
          </div>

          <series-chart-config 
            id="configPanel"
            series-id="${this.seriesId}"
            class="${this.chartConfigCollapsed ? 'hidden' : ''}">
          </series-chart-config>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Toggle collapsed
    const toggleBtn = this.querySelector('[data-action="toggle-collapsed"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleCollapsed());
    }

    // Chart scale click
    const chartElement = this.querySelector('#seriesChart');
    if (chartElement) {
      chartElement.addEventListener('scale-click', () => this.handleScaleClick());
    }

    // Config updates from SeriesChartConfig
    const configElement = this.querySelector('series-chart-config');
    if (configElement) {
      configElement.addEventListener('config-updated', (e) => this.handleConfigUpdated(e));
    }
  }

  async updateChart() {
    const chartElement = this.querySelector('#seriesChart');
    if (!chartElement || !this.entries.length) return;

    let viewDays = 0;
    const rangeConfig = { 'day': 1, 'week': 7, 'month': 30, 'quarter': 90, 'year': 365 };

    if (this.chartSettings.range !== 'all') {
      if (this.chartSettings.range === 'custom' && this.chartSettings.customDays) {
        viewDays = this.chartSettings.customDays;
      } else if (rangeConfig[this.chartSettings.range]) {
        viewDays = rangeConfig[this.chartSettings.range];
      }
    } else {
      if (this.entries.length > 0) {
        const firstDate = new Date(this.entries[0].timestamp);
        const lastDate = new Date(this.entries[this.entries.length - 1].timestamp);
        viewDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        if (viewDays < 1) viewDays = 1;
      }
    }

    const datasets = [];
    const rId = this.chartSettings.runningMetric;
    const win = this.chartSettings.window;

    const addSeriesToDatasets = (entries, label, color, isComparison = false) => {
      if (this.chartSettings.period === 'none') {
        const rawPoints = entries.map(e => ({
          x: e.timestamp,
          y: e.value
        }));

        datasets.push({
          label: label,
          data: rawPoints,
          borderColor: color,
          borderWidth: isComparison ? 1.5 : 2,
          tension: 0.2,
          borderDash: isComparison ? [10, 2] : []
        });

        if (!isComparison && rId && win >= 2 && entries.length >= win) {
          const runningPoints = [];
          for (let i = 0; i <= entries.length - win; i++) {
            const slice = entries.slice(i, i + win);
            const vals = slice.map(e => e.value).sort((a, b) => a - b);
            const stats = calculateStats(vals, [], slice);
            const midIdx = Math.floor(i + (win - 1) / 2);

            runningPoints.push({
              x: entries[midIdx].timestamp,
              y: stats[rId]
            });
          }

          if (runningPoints.length > 0) {
            datasets.push({
              label: `Rolling ${this.metrics.find(m => m.id === rId)?.label || rId}`,
              data: runningPoints,
              borderColor: '#f59e0b',
              borderDash: [10, 2],
              borderWidth: 1.5,
              pointRadius: 0,
              hidePoints: true
            });
          }
        }
      } else {
        const agg = getPeriodData(entries, this.chartSettings.period);

        if (isComparison) {
          const metricToUse = 'mean';
          const points = agg.labels.map((k, i) => ({
            x: k + (this.chartSettings.period === 'day' ? '' : ' 12:00:00.000Z'),
            y: agg.datasets[metricToUse][i]
          })).filter(point => point.y !== null);

          if (points.length > 0) {
            datasets.push({
              label: `${label} (${metricToUse})`,
              data: points,
              borderColor: color,
              borderWidth: 1.5,
              borderDash: [10, 2],
              tension: 0.2
            });
          }
        } else {
          this.analysisSelection.forEach(mId => {
            const m = this.metrics.find(x => x.id === mId);
            const points = agg.labels.map((k, i) => ({
              x: k + (this.chartSettings.period === 'day' ? '' : ' 12:00:00.000Z'),
              y: agg.datasets[mId][i]
            })).filter(point => point.y !== null);

            if (points.length > 0) {
              datasets.push({
                label: m.label,
                data: points,
                borderColor: m.color,
                borderWidth: 2,
                tension: 0.2
              });
            }

            if (rId && win >= 2 && agg.labels.length >= win) {
              const runningPoints = [];
              const baseSource = agg.datasets[mId];

              for (let i = 0; i <= baseSource.length - win; i++) {
                const slice = baseSource.slice(i, i + win).filter(v => v !== null);
                if (slice.length === 0) continue;

                const sortedSlice = [...slice].sort((a, b) => a - b);
                const stats = calculateStats(sortedSlice);
                const midIdx = Math.floor(i + (win - 1) / 2);

                if (stats[rId] !== undefined) {
                  runningPoints.push({
                    x: agg.labels[midIdx] + (this.chartSettings.period === 'day' ? '' : ' 12:00:00.000Z'),
                    y: stats[rId]
                  });
                }
              }

              if (runningPoints.length > 0) {
                datasets.push({
                  label: `Rolling ${m.label} (${rId})`,
                  data: runningPoints,
                  borderColor: m.color,
                  borderDash: [8, 4],
                  borderWidth: 1.5,
                  pointRadius: 0,
                  hidePoints: true
                });
              }
            }
          });
        }
      }
    };

    // Add primary series
    addSeriesToDatasets(this.entries, this.series.name, '#4f46e5', false);

    // Add comparison series
    if (this.chartSettings.compareSeriesIds?.length) {
      const comparisonColors = ['#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316'];
      let colorIndex = 0;

      for (const compareId of this.chartSettings.compareSeriesIds) {
        const compareSeries = this.allSeries.find(s => s.id === compareId);
        if (compareSeries) {
          const compareEntries = await chronosDB.getEntriesForSeries(compareId);
          if (compareEntries.length > 0) {
            const allGroups = await chronosDB.getAllGroups();
            const compareGroup = allGroups.find(g => g.name === compareSeries.group);
            const color = compareGroup ? compareGroup.color : comparisonColors[colorIndex % comparisonColors.length];

            addSeriesToDatasets(compareEntries, compareSeries.name, color, true);
            colorIndex++;
          }
        }
      }
    }

    const chartData = { datasets };

    chartElement.options = {
      ...chartElement.options,
      logScale: this.chartSettings.logScale,
      darkMode: this.isDark,
      viewDays: viewDays,
      grid: {
        show: true,
        color: this.isDark ? '#334155' : '#e5e7eb'
      },
      axis: {
        show: true,
        color: this.isDark ? '#cbd5e1' : '#6b7280',
        fontSize: 11
      },
      valueFormatter: (value) => {
        if (this.series?.type === 'time') {
          return formatDuration(value, true);
        }
        return Number(value).toLocaleString(undefined, {
          maximumFractionDigits: 2
        });
      }
    };

    chartElement.data = chartData;
  }
}

customElements.define('series-chart', SeriesChart);