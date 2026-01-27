import { formatDuration, secondsToDHMS, getFormattedISO } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import db from './db.js';

class EntryModal extends HTMLElement {
  constructor() {
    super();
    this.editingEntry = null;
    this.activeSeries = null;
    this.entryForm = { 
      timestamp: '', 
      value: '', 
      notes: '', 
      dhms: { d: 0, h: 0, m: 0, s: 0 } 
    };
  }

  resetForm() {
    this.editingEntry = null;
    this.activeSeries = null;
    this.entryForm = { 
      timestamp: '', 
      value: '', 
      notes: '', 
      dhms: { d: 0, h: 0, m: 0, s: 0 } 
    };
    this.updateFormFields();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.innerHTML = `
      <div class="p-6">
        <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100" data-title>
          Add New Entry
        </h3>
        
        <div class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Date & Time (yyyy-MM-dd HH:mm:ss)
            </label>
            <input 
              type="text" 
              data-form-timestamp
              placeholder="2025-07-13 18:36:00" 
              class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" 
              autofocus>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Value
            </label>
            
            <div data-number-input>
              <input 
                type="number" 
                step="any" 
                data-form-value
                class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
            </div>

            <div data-time-input style="display: none;">
              <div class="grid grid-cols-4 gap-2 mt-1">
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Days</span>
                  <input 
                    type="number" 
                    data-form-days
                    min="0" 
                    class="w-full px-2 py-2 border rounded-lg text-center outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Hours</span>
                  <input 
                    type="number" 
                    data-form-hours
                    min="0" 
                    max="23" 
                    class="w-full px-2 py-2 border rounded-lg text-center outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Mins</span>
                  <input 
                    type="number" 
                    data-form-minutes
                    min="0" 
                    max="59" 
                    class="w-full px-2 py-2 border rounded-lg text-center outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Secs</span>
                  <input 
                    type="number" 
                    data-form-seconds
                    min="0" 
                    max="59" 
                    class="w-full px-2 py-2 border rounded-lg text-center outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Notes (Optional)
            </label>
            <input 
              type="text" 
              data-form-notes
              class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
          </div>
        </div>
      </div>
      
      <div class="px-6 py-4 bg-slate-50 flex justify-end space-x-3 dark:bg-slate-700">
        <button 
          data-cancel
          class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">
          Cancel
        </button>
        <button 
          data-save
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors">
          Save Entry
        </button>
      </div>
    `;
  }

  updateFormFields() {
    const title = this.querySelector('[data-title]');
    const timestampInput = this.querySelector('[data-form-timestamp]');
    const valueInput = this.querySelector('[data-form-value]');
    const notesInput = this.querySelector('[data-form-notes]');
    const daysInput = this.querySelector('[data-form-days]');
    const hoursInput = this.querySelector('[data-form-hours]');
    const minutesInput = this.querySelector('[data-form-minutes]');
    const secondsInput = this.querySelector('[data-form-seconds]');

    if (title) {
      title.textContent = this.editingEntry ? 'Edit Entry' : 'Add New Entry';
    }

    if (timestampInput) {
      timestampInput.value = this.entryForm.timestamp || '';
    }

    if (valueInput) {
      valueInput.value = this.entryForm.value || '';
    }

    if (notesInput) {
      notesInput.value = this.entryForm.notes || '';
    }

    if (daysInput) {
      daysInput.value = this.entryForm.dhms.d || 0;
    }

    if (hoursInput) {
      hoursInput.value = this.entryForm.dhms.h || 0;
    }

    if (minutesInput) {
      minutesInput.value = this.entryForm.dhms.m || 0;
    }

    if (secondsInput) {
      secondsInput.value = this.entryForm.dhms.s || 0;
    }

    this.updateValueInputVisibility();
  }

  updateValueInputVisibility() {
    const numberInput = this.querySelector('[data-number-input]');
    const timeInput = this.querySelector('[data-time-input]');

    if (this.activeSeries?.type === 'time') {
      if (numberInput) numberInput.style.display = 'none';
      if (timeInput) timeInput.style.display = 'block';
    } else {
      if (numberInput) numberInput.style.display = 'block';
      if (timeInput) timeInput.style.display = 'none';
    }
  }

  attachEventListeners() {
    // Timestamp input
    this.querySelector('[data-form-timestamp]')?.addEventListener('input', (e) => {
      this.entryForm.timestamp = e.target.value;
    });

    // Value input (for number type)
    this.querySelector('[data-form-value]')?.addEventListener('input', (e) => {
      this.entryForm.value = e.target.value;
    });

    // Time inputs
    this.querySelector('[data-form-days]')?.addEventListener('input', (e) => {
      this.entryForm.dhms.d = parseInt(e.target.value) || 0;
    });

    this.querySelector('[data-form-hours]')?.addEventListener('input', (e) => {
      this.entryForm.dhms.h = parseInt(e.target.value) || 0;
    });

    this.querySelector('[data-form-minutes]')?.addEventListener('input', (e) => {
      this.entryForm.dhms.m = parseInt(e.target.value) || 0;
    });

    this.querySelector('[data-form-seconds]')?.addEventListener('input', (e) => {
      this.entryForm.dhms.s = parseInt(e.target.value) || 0;
    });

    // Notes input
    this.querySelector('[data-form-notes]')?.addEventListener('input', (e) => {
      this.entryForm.notes = e.target.value;
    });

    // Save button
    this.querySelector('[data-save]')?.addEventListener('click', () => {
      this.saveEntry();
    });

    // Cancel button
    this.querySelector('[data-cancel]')?.addEventListener('click', () => {
      this.close();
    });

    // Enter key to save
    this.querySelector('[data-form-timestamp]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveEntry();
      }
    });

    // Escape key to close
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  async saveEntry() {
    if (!this.entryForm.timestamp || !this.activeSeries) {
      return;
    }

    let finalVal;
    if (this.activeSeries.type === 'time') {
      const { d, h, m, s } = this.entryForm.dhms;
      finalVal = (parseInt(d || 0) * 86400) + (parseInt(h || 0) * 3600) + (parseInt(m || 0) * 60) + parseInt(s || 0);
    } else {
      finalVal = parseFloat(this.entryForm.value);
    }

    if (isNaN(finalVal)) {
      return;
    }

    let cleanTimestamp = this.entryForm.timestamp.replace('T', ' ');
    const entryData = {
      timestamp: cleanTimestamp,
      notes: this.entryForm.notes,
      seriesId: this.activeSeries.id,
      value: finalVal
    };

    if (this.editingEntry) {
      entryData.id = this.editingEntry.id;
    }

    try {
      await db.saveEntry(entryData);

      // Update series summary
      const allEntries = await db.getEntriesForSeries(this.activeSeries.id);
      const tempSeries = JSON.parse(JSON.stringify(this.activeSeries));
      tempSeries.summaryDisplay = calculateSeriesSummary(tempSeries, allEntries, formatDuration.bind(this));
      await db.saveSeries(tempSeries);

      // Dispatch events to notify parent
      this.dispatchEvent(new CustomEvent('entry-saved', {
        detail: { 
          entry: entryData, 
          series: this.activeSeries,
          isNew: !this.editingEntry 
        },
        bubbles: true
      }));

      this.close();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  }

  openForNew(series) {
    this.editingEntry = null;
    this.activeSeries = series;
    this.entryForm = {
      timestamp: getFormattedISO(),
      value: 0,
      notes: '',
      dhms: { d: 0, h: 0, m: 0, s: 0 }
    };
    this.updateFormFields();
    this.setAttribute('open', '');

    // Focus on the timestamp input
    setTimeout(() => {
      const timestampInput = this.querySelector('[data-form-timestamp]');
      if (timestampInput) {
        timestampInput.focus();
        timestampInput.select();
      }
    }, 10);
  }

  openForEdit(entry, series) {
    this.editingEntry = entry;
    this.activeSeries = series;
    this.entryForm = {
      ...entry,
      dhms: series.type === 'time' ? secondsToDHMS(entry.value) : { d: 0, h: 0, m: 0, s: 0 }
    };
    this.updateFormFields();
    this.setAttribute('open', '');

    // Focus on the timestamp input
    setTimeout(() => {
      const timestampInput = this.querySelector('[data-form-timestamp]');
      if (timestampInput) {
        timestampInput.focus();
        timestampInput.select();
      }
    }, 10);
  }

  close() {
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true }));
  }
}

customElements.define('entry-modal', EntryModal);

export default EntryModal;