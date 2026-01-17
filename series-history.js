import { formatDuration } from './utils.js';

class SeriesHistory extends HTMLElement {
    constructor() {
        super();
        this._series = null;
        this._entries = [];
    }

    static get observedAttributes() {
        return ['series', 'entries'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'series') {
            this._series = newValue ? JSON.parse(newValue) : null;
        } else if (name === 'entries') {
            // Store entries; we sort them descending (newest first) for the history view
            this._entries = newValue ? JSON.parse(newValue).slice().reverse() : [];
        }
        this.render();
    }

    render() {
        if (!this._series) return;

        const entriesHtml = this._entries.length > 0 
            ? this._entries.map(entry => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium dark:text-slate-300">
                        ${entry.timestamp}
                    </td>
                    <td class="px-6 py-4 text-sm text-indigo-600 font-bold dark:text-indigo-400">
                        ${this._series.type === 'time' ? formatDuration(entry.value) : entry.value}
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                        ${entry.notes || '-'}
                    </td>
                    <td class="px-6 py-4 text-right space-x-3">
                        <button data-id="${entry.id}" data-action="edit" class="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors">Edit</button>
                        <button data-id="${entry.id}" data-action="delete" class="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors">Delete</button>
                    </td>
                </tr>
            `).join('')
            : `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 italic">No historical data available.</td></tr>`;

        this.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center dark:border-slate-700">
                    <h3 class="text-lg font-semibold dark:text-slate-100">Data History</h3>
                    <button id="addEntryBtn" class="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors dark:bg-indigo-700 dark:hover:bg-indigo-600">
                        + Add Entry
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                <th class="px-6 py-3">Date</th>
                                <th class="px-6 py-3">Value</th>
                                <th class="px-6 py-3">Notes</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                            ${entriesHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.querySelector('#addEntryBtn').onclick = () => {
            this.dispatchEvent(new CustomEvent('add-entry-click', { detail: { series: this._series } }));
        };

        this.querySelectorAll('button[data-id]').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const entry = this._entries.find(e => e.id === id);
                this.dispatchEvent(new CustomEvent(`${action}-entry-click`, { detail: { entry, id } }));
            };
        });
    }
}

customElements.define('series-history', SeriesHistory);