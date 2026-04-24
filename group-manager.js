import db from './db.js';
import { ColorPicker, DEFAULT_COLOR } from './color-picker.js';
import { ModalForm } from './modal-form.js';

const GroupEditor = ModalForm({
  id: 'group-editor-dialog',
  initState: () => ({
    form:   { name: '', color: DEFAULT_COLOR },
    group:  null,
    onAccept: null,
  }),
  onOpen: ({ group, onAccept }) => ({
    group,
    onAccept,
    form: {
      name:  group?.name  || '',
      color: group?.color || DEFAULT_COLOR,
    },
  }),
  label: (state) => state.group ? 'Edit Group' : 'Add Group',
  prepareData: (state) => {
    if (!state.form.name.trim()) return null;
    return {
      ...(state.group ? { id: Number(state.group.id) } : {}),
      name:  state.form.name.trim(),
      color: state.form.color,
    };
  },
  save: async (state, data) => {
    await db.saveGroup(data);
    if (state.group?.name && state.group.name !== data.name)
      await db.updateSeriesGroupNames(state.group.name, data.name);
    return data;
  },
  onSave: (state, result) => state.onAccept?.(result),
  fields: [
    { id: 'name'  , label: 'Group Name' , type: 'text'  , attrs: { placeholder: 'Group Name' } },
    { id: 'color' , label: 'Color'      , type: 'color' },
  ],
  extraAttrs: (state) => ({
    acceptLabel: 'Save Group',
    disabled:    !state.form.name.trim(),
  }),
});

const GroupManager = () => {
  let groups = [];

  const loadGroups = async (onGroupsUpdated) => {
    const result = await db.getAllGroups();
    groups = result.sort((a, b) => a.name.localeCompare(b.name));
    onGroupsUpdated?.();
    m.redraw();
  };

  const deleteGroup = async (onGroupsUpdated, groupId) => {
    if (!confirm('Delete group?')) return;
    await db.deleteGroup(groupId);
    await loadGroups(onGroupsUpdated);
  };

  return {
    oninit: ({ attrs: { onGroupsUpdated } }) => loadGroups(onGroupsUpdated),

    view({ attrs: { onGroupsUpdated } }) {
      const onAccept = () => loadGroups(onGroupsUpdated);

      return [
        m('wa-dialog[light-dismiss]#group-dialog', {
          label: 'Manage Groups',
        }, [
          // Action Bar
          m('.wa-justify-content-end',
            m([button, '.plain.brand.small'], {
              onclick: () => GroupEditor.open({ onAccept }),
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
                    key:     group.id,
                    onclick: () => GroupEditor.open({group, onAccept}),
                  }, [
                    m('.wa-cluster', [
                      m(icon`circle`, { style: `color: ${group.color || DEFAULT_COLOR};` }),
                      m('span', group.name),
                    ]),

                    m([button, '.plain.danger.small'], {
                      title: 'Delete group',
                      onclick(e) {
                        e.stopPropagation();
                        deleteGroup(onGroupsUpdated, group.id);
                      },
                    },
                      m(icon`trash`)
                    ),
                  ])
                )
          ),
        ]),

        m(GroupEditor),
      ];
    }
  };
};

export default GroupManager;