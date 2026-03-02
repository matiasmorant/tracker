import { themeManager } from './theme-utils.js';

export class ListHeader extends HTMLElement {
    constructor() {
        super();
        
        this.toggleTheme = this.toggleTheme.bind(this);
        this.handleFileInput = this.handleFileInput.bind(this);
    }

    connectedCallback() {
        this.render();
        themeManager.initTheme();
        this.attachEventListeners();
    }

    disconnectedCallback() {
        this.removeEventListeners();
    }

    render() {
        this.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="flex items-center space-x-2 cursor-pointer" data-action="go-home">
                    <div class="bg-indigo-600 p-2 rounded-lg text-white">
                        <sl-icon name="graph-up-arrow" style="font-size: 24px;"></sl-icon>
                    </div>
                    <h1 class="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Chronos</h1>
                </div>
                <div class="flex items-center space-x-3">
                    <sl-dropdown>
                        <sl-button slot="trigger" variant="default">
                            <sl-icon slot="prefix" name="file-earmark-arrow-down"></sl-icon>
                            Data
                            <sl-icon slot="suffix" name="chevron-down" style="font-size: 10px;"></sl-icon>
                        </sl-button>
                        <sl-menu>
                            <sl-menu-item disabled>
                                <span slot="label" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transfer</span>
                            </sl-menu-item>
                            <sl-menu-item data-action="export-json">
                                <sl-icon slot="prefix" name="download"></sl-icon>
                                Export JSON
                            </sl-menu-item>
                            <sl-menu-item>
                                <sl-icon slot="prefix" name="upload"></sl-icon>
                                <label class="flex items-center cursor-pointer">
                                    Import JSON
                                    <input type="file" accept=".json,application/json" class="import-json-input hidden">
                                </label>
                            </sl-menu-item>
                            <sl-divider></sl-divider>
                            <sl-menu-item data-action="export-csv">
                                <sl-icon slot="prefix" name="file-earmark-spreadsheet"></sl-icon>
                                Export CSV
                            </sl-menu-item>
                            <sl-menu-item>
                                <sl-icon slot="prefix" name="file-earmark-arrow-up"></sl-icon>
                                <label class="flex items-center cursor-pointer">
                                    Import CSV
                                    <input type="file" accept=".csv,text/csv" class="import-csv-input hidden">
                                </label>
                            </sl-menu-item>
                            <sl-divider></sl-divider>
                            <sl-menu-item data-action="toggle-theme">
                                <sl-icon slot="prefix" name="moon" id="theme-icon-light"></sl-icon>
                                <sl-icon slot="prefix" name="sun" id="theme-icon-dark" class="hidden"></sl-icon>
                                <span id="theme-text">${themeManager.getCurrentTheme() === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                            </sl-menu-item>
                        </sl-menu>
                    </sl-dropdown>
                    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                    <button class="groups-btn text-slate-600 hover:text-indigo-600 text-sm font-medium dark:text-slate-300 dark:hover:text-indigo-400">Groups</button>
                    <sl-button variant="primary" class="new-series-btn">
                        + New Series
                    </sl-button>
                </div>
            </div>
        `;

        themeManager.updateThemeIcons(this);
    }

    attachEventListeners() {
        const homeBtn = this.querySelector('[data-action="go-home"]');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('home-click'));
            });
        }

        const exportJsonBtn = this.querySelector('[data-action="export-json"]');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('export-json'));
            });
        }

        const importJsonInput = this.querySelector('.import-json-input');
        if (importJsonInput) {
            importJsonInput.addEventListener('change', (e) => this.handleFileInput(e, 'json'));
        }

        const exportCsvBtn = this.querySelector('[data-action="export-csv"]');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('export-csv'));
            });
        }

        const importCsvInput = this.querySelector('.import-csv-input');
        if (importCsvInput) {
            importCsvInput.addEventListener('change', (e) => this.handleFileInput(e, 'csv'));
        }

        const themeToggleBtn = this.querySelector('[data-action="toggle-theme"]');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', this.toggleTheme);
        }

        const groupsBtn = this.querySelector('.groups-btn');
        if (groupsBtn) {
            groupsBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('groups-click'));
            });
        }

        const newSeriesBtn = this.querySelector('.new-series-btn');
        if (newSeriesBtn) {
            newSeriesBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('new-series-click'));
            });
        }
    }

    removeEventListeners() {
    }

    toggleTheme() {
        const newTheme = themeManager.toggleTheme();
        themeManager.updateThemeIcons(this);
        
        this.dispatchEvent(new CustomEvent('theme-change', {
            detail: { theme: newTheme }
        }));
    }

    handleFileInput(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        const detail = { file, type };
        this.dispatchEvent(new CustomEvent('import-file', { detail }));
        
        event.target.value = '';
    }
}

customElements.define('list-header', ListHeader);
