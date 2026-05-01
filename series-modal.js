import { Actions } from './mithril-state-actions.js';
import db from './db.js';
import { withDefaults } from './utils.js';
import { ModalForm } from './modal-form.js';

const SeriesModal = ModalForm({
  id: 'series-dialog',
  initState: () => ({
    groups:     [],
    form:       {},
    lastSeries: null,
  }),
  onOpen: async ({ series }) => {
    const allGroups = await db.groups.toArray();
    const groups = allGroups.slice().sort((a, b) => a.name.localeCompare(b.name));
    return  { lastSeries: series, form: withDefaults(series, {
      name:   '',
      type:   'number',
      group:  '',
      config: { summaryMetrics: [], summaries: [], quickAddAction: 'manual' },
    }), groups };
  },
  label: (state) => state.lastSeries ? 'Edit Series' : 'Create New Series',
  prepareData: (state) => {
    if (!state.form.name.trim()) return null;
    return {
      ...(state.lastSeries ? { id: state.lastSeries.id } : {}),
      name:   state.form.name.trim(),
      type:   state.form.type,
      group:  state.form.group,
      config: { ...state.form.config },
    };
  },
  save: async (state, data) => {
    await db.series.put(data);
    return { series: data, isNew: !state.lastSeries };
  },
  onSave: (state, result) => Actions.loadSeries(),
  fields: (state) => [
    { id: 'name',  label: 'Name',  type: 'text',   attrs: { placeholder: 'Series name' } },
    { id: 'type',  label: 'Type',  type: 'select', options: [
        { value: 'number', label: 'Number' },
        { value: 'time',   label: 'Time'   },
      ],
    },
    { id: 'group', label: 'Group', type: 'select', options: [
        { value: '', label: '' },
        ...state.groups.map(g => ({ value: g.name, label: g.name })),
      ],
    },
  ],
  extraAttrs: (state) => ({
    acceptLabel: state.lastSeries ? 'Save Changes' : 'Save Series',
    disabled:    !state.form.name?.trim(),
  }),
});

export default SeriesModal;
