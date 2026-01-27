import db from './db.js';

class SeriesModal extends HTMLElement {
  constructor() {
    super();
    this.seriesForm = { 
      name: '', 
      group: '', 
      type: 'number', 
      config: { summaryMetrics: [], summaries: [], quickAddAction: 'manual' }
    };
    this.editingSeries = null;
    this.groups = [];
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.loadGroups();
  }

  resetForm() {
    this.editingSeries = null;
    this.seriesForm = { 
      name: '', 
      group: '', 
      type: 'number', 
      config: { summaryMetrics: [], summaries: [], quickAddAction: 'manual' }
    };
    this.updateFormFields();
  }

  render() {
    this.innerHTML = `
      <div class="p-6">
        <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100" data-title>
          Create New Series
        </h3>
        
        <div class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <input 
              type="text" 
              data-form-name
              class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100" 
              autofocus
              placeholder="Series name">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Type
            </label>
            <select 
              data-form-type
              class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
              <option value="number">Number</option>
              <option value="time">Time</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Group
            </label>
            <select 
              data-form-group
              class="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
              <option value="">Uncategorized</option>
              <!-- Groups will be populated dynamically -->
            </select>
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
          Save Series
        </button>
      </div>
    `;
  }

  async loadGroups() {
    try {
      this.groups = await db.getAllGroups();
      this.groups.sort((a, b) => a.name.localeCompare(b.name));
      this.updateGroupOptions();
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }

  updateGroupOptions() {
    const groupSelect = this.querySelector('[data-form-group]');
    if (!groupSelect) return;

    // Keep the current selected value
    const currentValue = groupSelect.value;
    
    // Clear existing options except the first one
    while (groupSelect.options.length > 1) {
      groupSelect.remove(1);
    }
    
    // Add group options
    this.groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.name;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
    
    // Restore the selected value if it exists in the new options
    if (this.groups.some(g => g.name === currentValue)) {
      groupSelect.value = currentValue;
    }
  }

  updateFormFields() {
    const nameInput = this.querySelector('[data-form-name]');
    const typeSelect = this.querySelector('[data-form-type]');
    const groupSelect = this.querySelector('[data-form-group]');
    const title = this.querySelector('[data-title]');

    if (nameInput) {
      nameInput.value = this.seriesForm.name || '';
    }
    
    if (typeSelect) {
      typeSelect.value = this.seriesForm.type || 'number';
    }
    
    if (groupSelect) {
      groupSelect.value = this.seriesForm.group || '';
    }
    
    if (title) {
      title.textContent = this.editingSeries ? 'Edit Series' : 'Create New Series';
    }
  }

  attachEventListeners() {
    // Name input
    this.querySelector('[data-form-name]')?.addEventListener('input', (e) => {
      this.seriesForm.name = e.target.value;
    });

    // Type select
    this.querySelector('[data-form-type]')?.addEventListener('change', (e) => {
      this.seriesForm.type = e.target.value;
    });

    // Group select
    this.querySelector('[data-form-group]')?.addEventListener('change', (e) => {
      this.seriesForm.group = e.target.value;
    });

    // Save button
    this.querySelector('[data-save]')?.addEventListener('click', () => {
      this.saveSeries();
    });

    // Cancel button
    this.querySelector('[data-cancel]')?.addEventListener('click', () => {
      this.close();
    });

    // Enter key to save
    this.querySelector('[data-form-name]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveSeries();
      }
    });

    // Escape key to close
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  async saveSeries() {
    if (!this.seriesForm.name?.trim()) {
      return;
    }

    const seriesData = {
      name: this.seriesForm.name.trim(),
      type: this.seriesForm.type || 'number',
      group: this.seriesForm.group || '',
      config: { ...this.seriesForm.config }
    };

    try {
      if (this.editingSeries) {
        // Update existing series
        seriesData.id = this.editingSeries.id;
        await db.saveSeries(seriesData);
      } else {
        // Create new series
        await db.saveSeries(seriesData);
      }

      // Dispatch event to notify parent
      this.dispatchEvent(new CustomEvent('series-saved', {
        detail: { series: seriesData, isNew: !this.editingSeries },
        bubbles: true
      }));

      this.close();
    } catch (error) {
      console.error('Error saving series:', error);
    }
  }

  openForEdit(series) {
    this.editingSeries = series;
    this.seriesForm = {
      name: series.name || '',
      type: series.type || 'number',
      group: series.group || '',
      config: series.config || { summaryMetrics: [], summaries: [], quickAddAction: 'manual' }
    };
    this.updateFormFields();
    this.setAttribute('open', '');
    
    // Focus on the name input
    setTimeout(() => {
      const nameInput = this.querySelector('[data-form-name]');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 10);
  }

  openForNew() {
    this.editingSeries = null;
    this.seriesForm = { 
      name: '', 
      group: '', 
      type: 'number', 
      config: { summaryMetrics: [], summaries: [], quickAddAction: 'manual' }
    };
    this.updateFormFields();
    this.setAttribute('open', '');
    
    // Focus on the name input
    setTimeout(() => {
      const nameInput = this.querySelector('[data-form-name]');
      if (nameInput) {
        nameInput.focus();
      }
    }, 10);
  }

  close() {
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true }));
  }
}

customElements.define('series-modal', SeriesModal);

export default SeriesModal;