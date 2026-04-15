import db from './db.js';
import { ColorPicker, DEFAULT_COLOR } from './color-picker.js';
import ModalForm from './modal-form.js';

const open = (id)=>document.querySelector(id).open=true;

const GroupEditor = () => {
  let saving = false;
  let form = { name: '', color: DEFAULT_COLOR };

  return {
    view({ attrs }) {
      const { group, onGroupsUpdated } = attrs;
      const isEditing = !!group;
      
      form.name  = group?.name || '';
      form.color = group?.color || DEFAULT_COLOR;

      const save = async () => {
        if (saving || !form.name.trim()) return;
        saving = true;

        const groupData = {
          name: form.name.trim(),
          color: form.color,
        };

        try {
          if (isEditing) {
            groupData.id = Number(group.id);
            const oldName = group.name;
            await db.saveGroup(groupData);
            if (oldName !== groupData.name) {
              await db.updateSeriesGroupNames(oldName, groupData.name);
            }
          } else {
            await db.saveGroup(groupData);
          }
          onGroupsUpdated?.();
        } catch (err) {
          console.error('Error saving group:', err);
        } finally {
          saving = false;
          m.redraw();
        }
      };

      return m(ModalForm, {
        id: 'group-editor-dialog',
        label: isEditing ? 'Edit Group' : 'Add Group',
        onAccept: save,
        acceptLabel: 'Save Group',
        loading: saving,
      },
      [
        m('wa-input', {
          placeholder: 'Group Name',
          autofocus: true,
          value: form.name,
          oninput(e) { form.name = e.target.value; },
        }),
        m(ColorPicker, {
          selectedColor: form.color,
          onSelect(color) {
            form.color = color;
            if (isEditing && !saving) save();
          },
        }),
      ]);
    }
  };
};

const GroupManager = () => {
  let groups = [];
  let selectedGroup = null;

  const loadGroups = async (vnode) => {
    try {
      const result = await db.getAllGroups();
      groups = result.sort((a, b) => a.name.localeCompare(b.name));
      vnode.attrs.onGroupsUpdated?.();
      m.redraw();
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  };

  const deleteGroup = async (vnode, groupId) => {
    if (!confirm('Delete group?')) return;
    try {
      await db.deleteGroup(groupId);
      await loadGroups(vnode);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  return {
    oninit: (vnode) => loadGroups(vnode),
    view(vnode) {
      return [
        m('wa-dialog[light-dismiss]#group-dialog', {
          label: 'Manage Groups',
        }, [
          // Action Bar
          m('.wa-justify-content-end',
            m([button, '.plain.brand.small'], {
              'data-dialog': 'open group-editor-dialog',
              onclick: () => { selectedGroup = null; }
            }, [
              m(icon`plus`),
              'Add New',
            ])
          ),

          // Group list
          m('wa-scroller.max-h-64',
            groups.length === 0
              ? m('p', {
                style: 'color: var(--wa-color-neutral-500); font-size: var(--wa-font-size-s); text-align: center; padding: var(--wa-space-m) 0; margin: 0',
              }, 'No groups yet.')
              : groups.map(group =>
                m('.wa-split', {
                  key: group.id,
                  'data-dialog': 'open group-editor-dialog',
                  onclick: () => { selectedGroup = group;},
                }, [
                  m('.wa-cluster', [
                    m(icon`circle`, { style: `color: ${group.color || DEFAULT_COLOR};` }),
                    m('span', group.name),
                  ]),

                  m([button, '.plain.danger.small'], {
                    title: 'Delete group',
                    onclick(e) {
                      e.stopPropagation();
                      deleteGroup(vnode, group.id);
                    },
                  },
                    m(icon`trash`)
                  ),
                ])
              )
          ),
        ]),

        // Mount Editor Dialog alongside Manager
        m(GroupEditor, {
          group: selectedGroup,
          onGroupsUpdated: () => loadGroups(vnode)
        })
      ];
    }
  };
};

export default GroupManager;