import db from './db.js';
import { State, Actions } from './mithril-state-actions.js';
import { ColorPicker, DEFAULT_COLOR } from './color-picker.js';

const GroupManager = {
  oninit(vnode) {
    vnode.state.groups = [];
    vnode.state.showForm = false;
    vnode.state.editingGroup = null;
    vnode.state.form = { name: '', color: DEFAULT_COLOR };
    vnode.state.saving = false;
    GroupManager.loadGroups(vnode.state);
  },

  async loadGroups(state) {
    try {
      const groups = await db.getAllGroups();
      state.groups = groups.sort((a, b) => a.name.localeCompare(b.name));
      m.redraw();
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  },

  openAddForm(state) {
    state.showForm = true;
    state.editingGroup = null;
    state.form = { name: '', color: DEFAULT_COLOR };
  },

  openEditForm(state, group) {
    state.editingGroup = group;
    state.showForm = true;
    state.form = { name: group.name, color: group.color || DEFAULT_COLOR };
  },

  cancelForm(state) {
    state.showForm = false;
    state.editingGroup = null;
    state.form = { name: '', color: DEFAULT_COLOR };
  },

  async saveGroup(vnode, exitForm = true) {
    const state = vnode.state;
    if (state.saving || !state.form.name.trim()) return;
    state.saving = true;

    const groupData = {
      name: state.form.name.trim(),
      color: state.form.color,
    };

    try {
      if (state.editingGroup) {
        const groupId = Number(state.editingGroup.id);
        if (isNaN(groupId)) throw new Error('Invalid group ID');
        groupData.id = groupId;

        const oldName = state.editingGroup.name;
        await db.saveGroup(groupData);

        if (oldName !== groupData.name) {
          await GroupManager.updateSeriesGroupNames(oldName, groupData.name);
        }

        state.editingGroup.name = groupData.name;
        state.editingGroup.color = groupData.color;

        if (exitForm) {
          state.showForm = false;
          state.editingGroup = null;
        }
      } else {
        await db.saveGroup(groupData);
        state.showForm = false;
      }

      await GroupManager.loadGroups(state);
      vnode.attrs.onGroupsUpdated?.();
    } catch (err) {
      console.error('Error saving group:', err);
    } finally {
      state.saving = false;
      m.redraw();
    }
  },

  async updateSeriesGroupNames(oldName, newName) {
    try {
      const allSeries = await db.getAllSeries();
      for (const series of allSeries.filter(s => s.group === oldName)) {
        series.group = newName;
        await db.saveSeries(series);
      }
    } catch (err) {
      console.error('Error updating series group names:', err);
    }
  },

  async deleteGroup(vnode, groupId) {
    if (!confirm('Delete group?')) return;
    try {
      await db.deleteGroup(groupId);
      await GroupManager.loadGroups(vnode.state);
      vnode.attrs.onGroupsUpdated?.();
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  },

  view(vnode) {
    const state = vnode.state;
    const isEditing = !!state.editingGroup;
    const dialogLabel = isEditing ? 'Edit Group' : 'Manage Groups';

    return m('wa-dialog#group-dialog[light-dismiss]', {
        label: dialogLabel,
        'onwa-after-hide': () => {
          GroupManager.cancelForm(state);
          m.redraw();
        },
      },

      [
        !state.showForm && m('.wa-justify-content-end',
          m([button, '.plain.brand.small'], {
            onclick() { GroupManager.openAddForm(state); },
          }, [
            m(icon`plus`),
            'Add New',
          ])
        ),

        // Group list
        !state.showForm && m('wa-scroller.max-h-64',
          state.groups.length === 0
          ? m('p', {
              style: 'color: var(--wa-color-neutral-500); font-size: var(--wa-font-size-s); text-align: center; padding: var(--wa-space-m) 0; margin: 0',
            }, 'No groups yet.')
            : state.groups.map(group =>
              m('.wa-split', {
                key: group.id,
                onclick() { GroupManager.openEditForm(state, group); },
              }, [
                m('.wa-cluster', [
                  m(icon`circle`, { style:`color: ${group.color || DEFAULT_COLOR};`}),
                  m('span', group.name),
                ]),

                m([button, '.plain.danger.small'], {
                  title: 'Delete group',
                  onclick(e) {
                    e.stopPropagation();
                    GroupManager.deleteGroup(vnode, group.id);
                  },
                },
                  m(icon`trash`)
                ),
              ])
            )
        ),

        // Add / Edit form
        state.showForm && m('.wa-stack', [
          m('wa-input', {
            placeholder: 'Group Name',
            value: state.form.name,
            oncreate({dom}) { setTimeout(() => { // What about using input autofocus?
              dom.focus();
              if (isEditing) dom.select();
            }, 200); },
            oninput(e) { state.form.name = e.target.value; },
            onkeydown(e) {
              if (e.key === 'Enter') GroupManager.saveGroup(vnode, true);
              if (e.key === 'Escape') GroupManager.cancelForm(state);
            },
          }),
          m(ColorPicker, {
            selectedColor: state.form.color,
            onSelect(color) {
              state.form.color = color;
              // Auto-save color change when editing, without closing the form
              if (state.editingGroup && !state.saving) {
                GroupManager.saveGroup(vnode, false);
              }
            },
          }),

          m('.wa-cluster.wa-justify-content-end', [
            m([button, '.outlined'], {
              onclick() { GroupManager.cancelForm(state); },
            }, 'Cancel'),

            m([button, '.brand.filled'], {
              loading: state.saving || undefined,
              onclick() { GroupManager.saveGroup(vnode, true); },
            }, 'Save Group'),
          ]),
        ]),
      ]
    );
  },
};

export default GroupManager;