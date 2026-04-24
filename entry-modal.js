import { State, Actions } from './mithril-state-actions.js';
import { format } from './utils.js';
import db from './db.js';
import { ModalForm } from './modal-form.js';

const newForm = () => ({ timestamp: format.dateTime(new Date()), value: 0, notes: '' });

const EntryModal = ModalForm({
  id: 'entry-modal',
  initState: () => ({
    form:         newForm(),
    entry: null,
    series: null,
  }),
  onOpen: ({ series, entry }) => ({ entry, series, form: entry || newForm() }),
  label: (state) => state.entry ? 'Edit Entry' : 'Add New Entry',
  prepareData: (state) => {
    if (!state.form.timestamp || !state.series) return null;
    const value = parseFloat(state.form.value);
    if (isNaN(value)) return null;
    const data = {
      timestamp: state.form.timestamp.replace('T', ' '),
      notes:     state.form.notes,
      seriesId:  state.series.id,
      value,
    };
    if (state.entry) data.id = state.entry.id;
    return data;
  },
  save: async (state, data) => {
    const result = await db.saveEntry(data, true);
    return { ...result, isNew: !state.entry };
  },
  onSave: (state, result) => {
    Actions.loadSeries();
    if (State.currentSeries?.id === result.series.id)
      Actions.loadEntries(State.currentSeries.id);
  },
  fields: (state) => [
    { id: 'timestamp' , label: 'Date & Time'      , type: 'datetime' },
    { id: 'value'     , label: 'Value'            , type: (state.series?.type === 'time') ? 'dhms' : 'number' },
    { id: 'notes'     , label: 'Notes (Optional)' , type: 'text' },
  ],
  extraAttrs: { acceptLabel: 'Save Entry' },
});

export default EntryModal;