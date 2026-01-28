import { themeManager } from './theme-utils.js';

export class ListHeader extends HTMLElement {
    constructor() {
        super();
        
        // Store references
        this.dropdownOpen = false;
        
        // Bind methods
        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.closeDropdown = this.closeDropdown.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleFileInput = this.handleFileInput.bind(this);
        this.exportData = this.exportData.bind(this);
        this.exportCSV = this.exportCSV.bind(this);
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
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                        </svg>
                    </div>
                    <h1 class="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Chronos</h1>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <button class="data-dropdown-toggle flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-300 dark:hover:bg-slate-700">
                            <i class="fa-solid fa-file-import"></i>
                            <span>Data</span>
                            <i class="fa-solid fa-chevron-down text-[10px]"></i>
                        </button>

                        <div class="dropdown-menu absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden dark:bg-slate-800 dark:border-slate-700 hidden">
                            <div class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-700 dark:text-slate-500">Transfer</div>
                            
                            <button class="export-json-btn w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400">
                                <i class="fa-solid fa-download w-5"></i> Export JSON
                            </button>
                            <label class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400">
                                <i class="fa-solid fa-upload w-5"></i> Import JSON
                                <input type="file" accept=".json,application/json" class="import-json-input hidden">
                            </label>

                            <div class="border-t border-slate-100 my-1 dark:border-slate-700"></div>
                            
                            <button class="export-csv-btn w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400">
                                <i class="fa-solid fa-file-csv w-5"></i> Export CSV
                            </button>
                            <label class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400">
                                <i class="fa-solid fa-file-import w-5"></i> Import CSV
                                <input type="file" accept=".csv,text/csv" class="import-csv-input hidden">
                            </label>

                            <div class="border-t border-slate-100 my-1 dark:border-slate-700"></div>
                            
                            <button class="theme-toggle-btn w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400">
                                <i class="fa-solid fa-moon w-5" id="theme-icon-light"></i>
                                <i class="fa-solid fa-sun w-5 hidden" id="theme-icon-dark"></i>
                                <span id="theme-text">${themeManager.getCurrentTheme() === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>
                        </div>
                    </div>
                    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                    <button class="groups-btn text-slate-600 hover:text-indigo-600 text-sm font-medium dark:text-slate-300 dark:hover:text-indigo-400">Groups</button>
                    <button class="new-series-btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm dark:bg-indigo-700 dark:hover:bg-indigo-600">
                        + New Series
                    </button>
                </div>
            </div>
        `;

        // Update theme icons
        themeManager.updateThemeIcons(this);
    }

    attachEventListeners() {
        // Remove any existing listeners first
        this.removeEventListeners();

        // Home/logo click
        const homeBtn = this.querySelector('[data-action="go-home"]');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('home-click'));
            });
        }

        // Data dropdown toggle
        const dropdownToggle = this.querySelector('.data-dropdown-toggle');
        if (dropdownToggle) {
            dropdownToggle.addEventListener('click', this.toggleDropdown);
        }

        // Export JSON
        const exportJsonBtn = this.querySelector('.export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', this.exportData);
        }

        // Import JSON
        const importJsonInput = this.querySelector('.import-json-input');
        if (importJsonInput) {
            importJsonInput.addEventListener('change', (e) => this.handleFileInput(e, 'json'));
        }

        // Export CSV
        const exportCsvBtn = this.querySelector('.export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', this.exportCSV);
        }

        // Import CSV
        const importCsvInput = this.querySelector('.import-csv-input');
        if (importCsvInput) {
            importCsvInput.addEventListener('change', (e) => this.handleFileInput(e, 'csv'));
        }

        // Theme toggle
        const themeToggleBtn = this.querySelector('.theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', this.toggleTheme);
        }

        // Groups button
        const groupsBtn = this.querySelector('.groups-btn');
        if (groupsBtn) {
            groupsBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('groups-click'));
            });
        }

        // New Series button
        const newSeriesBtn = this.querySelector('.new-series-btn');
        if (newSeriesBtn) {
            newSeriesBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('new-series-click'));
            });
        }

        // Add global click listener for dropdown
        document.addEventListener('click', this.handleClickOutside);
    }

    removeEventListeners() {
        document.removeEventListener('click', this.handleClickOutside);
    }

    toggleDropdown(e) {
        e.stopPropagation();
        this.dropdownOpen = !this.dropdownOpen;
        
        const dropdownMenu = this.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            if (this.dropdownOpen) {
                dropdownMenu.classList.remove('hidden');
            } else {
                dropdownMenu.classList.add('hidden');
            }
        }
    }

    closeDropdown() {
        this.dropdownOpen = false;
        const dropdownMenu = this.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.add('hidden');
        }
    }

    handleClickOutside(e) {
        if (!this.dropdownOpen) return;
        
        const dropdown = this.querySelector('.data-dropdown-toggle');
        const dropdownMenu = this.querySelector('.dropdown-menu');
        
        if (dropdown && dropdownMenu && 
            !dropdown.contains(e.target) && 
            !dropdownMenu.contains(e.target)) {
            this.closeDropdown();
        }
    }

    toggleTheme() {
        const newTheme = themeManager.toggleTheme();
        themeManager.updateThemeIcons(this);
        this.closeDropdown();
        
        // Dispatch theme change event
        this.dispatchEvent(new CustomEvent('theme-change', {
            detail: { theme: newTheme }
        }));
    }

    async exportData() {
        this.dispatchEvent(new CustomEvent('export-json'));
        this.closeDropdown();
    }

    async exportCSV() {
        this.dispatchEvent(new CustomEvent('export-csv'));
        this.closeDropdown();
    }

    handleFileInput(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Create a synthetic event with the file
        const detail = { file, type };
        this.dispatchEvent(new CustomEvent('import-file', { detail }));
        
        // Reset the input so the same file can be imported again
        event.target.value = '';
        this.closeDropdown();
    }
}

// Register the custom element
customElements.define('list-header', ListHeader);