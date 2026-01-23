import db from './db.js';

class GroupManager extends HTMLElement {
  constructor() {
    super();
    this.groups = [];
    this.showAddForm = false;
    this.editingGroup = null;
    this.groupForm = { name: '', color: '#6366f1' };
  }

  resetForm() {
    this.showAddForm = false;
    this.editingGroup = null;
    this.groupForm = { name: '', color: '#6366f1' };
    this.updateFormVisibility();
    this.updateFormFields();
    this.loadGroups();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.loadGroups();
  }

  async loadGroups() {
    try {
      this.groups = await db.getAllGroups();
      this.groups.sort((a, b) => a.name.localeCompare(b.name));
      this.renderGroupList();
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }

  render() {
    this.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100" data-title>Manage Groups</h3>
          <button 
            data-add-new
            class="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider dark:text-indigo-400 dark:hover:text-indigo-300">
            + Add New
          </button>
        </div>

        <div 
          data-add-form
          style="display: none;"
          class="space-y-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-700 dark:border-slate-600">
          
          <input 
            type="text" 
            data-form-name
            placeholder="Group Name" 
            class="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-600 dark:border-slate-500 dark:text-slate-100" 
            autofocus>
          
          <div class="grid grid-cols-6 gap-2" data-colors>
            ${['#6366f1', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#475569', '#94a3b8', '#14b8a6', '#f97316', '#ef4444']
              .map(color => `
                <button 
                  data-color="${color}"
                  class="h-8 rounded-md transition-all"
                  style="background-color: ${color}">
                </button>
              `).join('')}
          </div>
          
          <div class="flex gap-2">
            <button 
              data-save-group
              class="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600">
              Save Group
            </button>
          </div>
        </div>

        <div class="max-h-64 overflow-y-auto custom-scrollbar" data-group-list>
          <!-- Groups will be rendered here -->
        </div>
      </div>
    `;
  }

  renderGroupList() {
    const groupList = this.querySelector('[data-group-list]');
    if (!groupList) return;

    groupList.innerHTML = this.groups.map(g => `
      <div 
        data-group-id="${g.id}"
        class="flex items-center justify-between hover:bg-slate-50 rounded-lg group transition-colors dark:hover:bg-slate-700 cursor-pointer p-2">
        <div class="flex items-center space-x-3">
          <div class="w-3 h-3 rounded-full" style="background-color: ${g.color || '#6366f1'}"></div>
          <span class="font-medium text-slate-700 dark:text-slate-300">${g.name}</span>
        </div>
        <button 
          data-delete="${g.id}"
          class="p-1 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `).join('');
  }

  attachEventListeners() {
    // Add new button
    this.querySelector('[data-add-new]')?.addEventListener('click', () => {
      this.showAddForm = true;
      this.editingGroup = null;
      this.groupForm = { name: '', color: '#6366f1' };
      this.updateFormVisibility();
      this.updateFormFields();
      this.querySelector('[data-form-name]').focus();
    });

    // Color selection
    this.querySelector('[data-colors]')?.addEventListener('click', (e) => {
      const colorBtn = e.target.closest('[data-color]');
      if (colorBtn) {
        const color = colorBtn.getAttribute('data-color');
        this.groupForm.color = color;
        this.updateColorSelection();
        
        // Auto-save if editing, but don't exit editing mode
        if (this.editingGroup && !this._saving) {
          this.saveGroup(false); // false means stay in editing mode
        }
      }
    });

    // Save group
    this.querySelector('[data-save-group]')?.addEventListener('click', () => {
      this.saveGroup(true); // true means exit editing mode
    });

    // Enter key in name field
    this.querySelector('[data-form-name]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveGroup(true); // true means exit editing mode
      }
    });

    // Update form name on input without auto-saving
    this.querySelector('[data-form-name]')?.addEventListener('input', (e) => {
      this.groupForm.name = e.target.value;
    });

    // Also hide the form when pressing Escape while editing
    this.querySelector('[data-form-name]')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.editingGroup) {
        this.showAddForm = false;
        this.editingGroup = null;
        this.updateFormVisibility();
      }
    });

    // Group list events (delegated)
    this.querySelector('[data-group-list]')?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-delete]');
      const groupItem = e.target.closest('[data-group-id]');
      
      if (deleteBtn) {
        e.stopPropagation();
        const groupId = parseInt(deleteBtn.getAttribute('data-delete'));
        this.deleteGroup(groupId);
        return;
      }
      
      if (groupItem) {
        const groupId = parseInt(groupItem.getAttribute('data-group-id'));
        this.editGroup(groupId);
      }
    });
  }

  updateFormVisibility() {
    const addForm = this.querySelector('[data-add-form]');
    const title = this.querySelector('[data-title]');
    const addNewBtn = this.querySelector('[data-add-new]');

    if (this.showAddForm || this.editingGroup) {
      addForm.style.display = 'block';
      if (this.editingGroup) {
        title.textContent = 'Edit Group';
        addNewBtn.style.display = 'none';
      } else {
        title.textContent = 'Manage Groups';
        addNewBtn.style.display = 'block';
      }
    } else {
      addForm.style.display = 'none';
      title.textContent = 'Manage Groups';
      addNewBtn.style.display = 'block';
    }
  }

  updateFormFields() {
    const nameInput = this.querySelector('[data-form-name]');
    if (nameInput) {
      nameInput.value = this.groupForm.name || '';
    }
    this.updateColorSelection();
  }

  updateColorSelection() {
    this.querySelectorAll('[data-color]').forEach(btn => {
      const color = btn.getAttribute('data-color');
      if (color === this.groupForm.color) {
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400', 'dark:ring-slate-300');
      } else {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400', 'dark:ring-slate-300');
      }
    });
  }

  async editGroup(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    this.editingGroup = group;
    this.groupForm = { name: group.name, color: group.color || '#6366f1' };
    this.showAddForm = true;
    
    this.updateFormVisibility();
    this.updateFormFields();
    this.querySelector('[data-form-name]').focus();
    this.querySelector('[data-form-name]').select();
  }

  async saveGroup(exitEditingMode = true) {
    // Prevent multiple simultaneous saves
    if (this._saving) return;
    this._saving = true;

    if (!this.groupForm.name?.trim()) {
      this._saving = false;
      return;
    }

    const groupData = {
      name: this.groupForm.name.trim(),
      color: this.groupForm.color
    };

    try {
      if (this.editingGroup) {
        // Ensure the id is a number
        const groupId = Number(this.editingGroup.id);
        if (isNaN(groupId)) {
          throw new Error('Invalid group ID');
        }
        groupData.id = groupId;
      
        const oldName = this.editingGroup.name;
        const newName = groupData.name;
      
        console.log('Updating group with ID:', groupId, groupData);
        await db.saveGroup(groupData);
      
        if (oldName !== newName) {
          await this.updateSeriesGroupNames(oldName, newName);
        }
      
        // Update the local editingGroup object with new values
        this.editingGroup.name = newName;
        this.editingGroup.color = groupData.color;
        
        // Exit editing mode if requested
        if (exitEditingMode) {
          this.showAddForm = false;
          this.editingGroup = null;
        }
      } else {
        console.log('Creating new group:', groupData);
        await db.saveGroup(groupData);
        this.showAddForm = false;
      }

      await this.loadGroups();
      this.updateFormVisibility();
    
      this.dispatchEvent(new CustomEvent('groups-updated'));
    
    } catch (error) {
      console.error('Error saving group:', error);
    } finally {
      this._saving = false;
    }
  }

  async updateSeriesGroupNames(oldName, newName) {
    try {
      const allSeries = await db.getAllSeries();
      const seriesToUpdate = allSeries.filter(s => s.group === oldName);
      
      for (const series of seriesToUpdate) {
        series.group = newName;
        await db.saveSeries(series);
      }
    } catch (error) {
      console.error('Error updating series group names:', error);
    }
  }

  async deleteGroup(groupId) {
    if (!confirm('Delete group?')) return;

    try {
      await db.deleteGroup(groupId);
      await this.loadGroups();
      
      this.dispatchEvent(new CustomEvent('groups-updated'));
      
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  }
}

customElements.define('group-manager', GroupManager);
