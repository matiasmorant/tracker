// detail-header.js
export class DetailHeader extends HTMLElement {
    constructor() {
        super();
        
        // Store references
        this.currentSeries = null;
        
        // Bind methods
        this.updateSeriesName = this.updateSeriesName.bind(this);
        this.deleteSeries = this.deleteSeries.bind(this);
    }

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    // Update current series
    setCurrentSeries(series) {
        this.currentSeries = series;
        this.render();
        this.attachEventListeners();
    }

    render() {
        if (!this.currentSeries) return;

        this.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center space-x-3 flex-1">
                    <button class="back-btn p-2 -ml-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="relative flex items-center group cursor-text flex-1 max-w-md">
                        <input 
                            type="text" 
                            value="${this.currentSeries.name || ''}"
                            class="series-name-input bg-transparent border-b border-slate-300 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 rounded-sm px-1 -ml-1 w-full outline-none transition-all pr-8"
                        >
                        <i class="fa-solid fa-pen text-[10px] text-slate-400 absolute right-2 pointer-events-none dark:text-slate-500"></i>
                    </div>
                </div>
        
                <button 
                    class="delete-series-btn p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                    title="Delete Series"
                >
                    <i class="fa-solid fa-trash-can text-lg"></i>
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        // Back button
        const backBtn = this.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('back-click'));
            });
        }

        // Series name input
        const seriesNameInput = this.querySelector('.series-name-input');
        if (seriesNameInput) {
            seriesNameInput.addEventListener('change', this.updateSeriesName);
            seriesNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        }

        // Delete series button
        const deleteSeriesBtn = this.querySelector('.delete-series-btn');
        if (deleteSeriesBtn) {
            deleteSeriesBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this series?')) {
                    this.deleteSeries();
                }
            });
        }
    }

    async updateSeriesName() {
        const input = this.querySelector('.series-name-input');
        if (!input || !this.currentSeries || !input.value.trim()) return;
        
        const oldName = this.currentSeries.name;
        this.currentSeries.name = input.value.trim();
        
        this.dispatchEvent(new CustomEvent('series-name-update', {
            detail: { 
                series: this.currentSeries,
                oldName 
            }
        }));
    }

    async deleteSeries() {
        this.dispatchEvent(new CustomEvent('delete-series', {
            detail: { seriesId: this.currentSeries.id }
        }));
    }
}

// Register the custom element
customElements.define('detail-header', DetailHeader);