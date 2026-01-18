import { formatDuration } from './utils.js';

class SeriesHistory extends HTMLElement {
    constructor() {
        super();
        this._series = null;
        this._entries = [];
        this.table = null;
    }

    static get observedAttributes() {
        return ['series', 'entries'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'series') {
            this._series = newValue ? JSON.parse(newValue) : null;
        } else if (name === 'entries') {
            this._entries = newValue ? JSON.parse(newValue).slice().reverse() : [];
        }
        this.render();
    }

    render() {
        if (!this._series) return;

        this.innerHTML = `
            <style>
                #table-container .tabulator-row .tabulator-cell:first-child {
                    border-left: none !important;
                }
                .dark #table-container .tabulator {
                    background-color: transparent;
                    border: none;
                }
                .tabulator-header {
                    font-size: 1em !important;
                }
            </style>
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center dark:border-slate-700">
                    <h3 class="text-lg font-semibold dark:text-slate-100">Data History</h3>
                    <button id="addEntryBtn" class="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors dark:bg-indigo-700 dark:hover:bg-indigo-600">
                        + Add Entry
                    </button>
                </div>
                <div id="table-container" class="w-full"></div>
            </div>
        `;

        this.initTable();

        this.querySelector('#addEntryBtn').onclick = () => {
            this.dispatchEvent(new CustomEvent('add-entry-click', { detail: { series: this._series } }));
        };
    }

    initTable() {
        const container = this.querySelector('#table-container');
        
        this.table = new Tabulator(container, {
            data: this._entries,
            layout: "fitColumns",
            responsiveLayout: false, 
            resizableColumns: false,
            resizableColumnFit: false,
            placeholder: "No historical data available.",
            columns: [
                { 
                    title: "Date", 
                    field: "timestamp", 
                    sorter: "string", 
                    hozAlign: "left",
                    width: 180,
                    resizable: false,
                    editor: "input"
                },
                { 
                    title: "Value", 
                    field: "value", 
                    hozAlign: "right",
                    width: 100,
                    resizable: false,
                    editor: "number",
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return this._series.type === 'time' ? formatDuration(val) : val;
                    }
                },
                { 
                    title: "Notes", 
                    field: "notes", 
                    editor: "textarea", 
                    resizable: false,
                    formatter: (cell) => cell.getValue() || "-" 
                },
                {
                    title: "Actions",
                    field: "id",
                    headerSort: false,
                    hozAlign: "right",
                    width: 100,
                    resizable: false,
                    formatter: () => `<button class="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors">Delete</button>`,
                    cellClick: (e, cell) => {
                        const entry = cell.getData();
                        this.dispatchEvent(new CustomEvent('delete-entry-click', { 
                            detail: { entry, id: entry.id } 
                        }));
                    }
                }
            ],
        });

        this.table.on("cellEdited", (cell) => {
            const updatedEntry = cell.getData();
            this.dispatchEvent(new CustomEvent('entry-updated', { 
                detail: { entry: updatedEntry } 
            }));
        });
    }
}

customElements.define('series-history', SeriesHistory);