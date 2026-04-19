import { format, Duration, toggleModal } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import { State, Actions } from './mithril-state-actions.js';
import dhmsField from './dhmsField.js'
import db from './db.js';
import ModalForm from './modal-form.js';

// Internal form state — lives outside the component so it survives redraws
// while the dialog is open, and is reset on open.
let form = { timestamp: '', value: '', notes: '', dhms: new Duration(), };

let editingEntry = null;
let activeSeries = null;

function resetForm() {
  editingEntry = null;
  activeSeries = null;
  form = { timestamp: '', value: '', notes: '', dhms: new Duration() };
}

function openForNew(series) {
  editingEntry = null;
  activeSeries = series;
  form = {
    timestamp: format.dateTime(new Date()),
    value: '',
    notes: '',
    dhms: new Duration(),
  };
}

function openForEdit(entry, series) {
  editingEntry = entry;
  activeSeries = series;
  form = {
    timestamp: entry.timestamp,
    value: entry.value,
    notes: entry.notes || '',
    dhms: new Duration(series.type === 'time' ? entry.value : 0),
  };
}

async function saveEntry(dispatch) {
  if (!form.timestamp || !activeSeries) return;

  let finalVal;
  if (activeSeries.type === 'time') {
    finalVal = form.dhms.toTotalSeconds();
  } else {
    finalVal = parseFloat(form.value);
  }

  if (isNaN(finalVal)) return;

  const entryData = {
    timestamp: form.timestamp.replace('T', ' '),
    notes: form.notes,
    seriesId: activeSeries.id,
    value: finalVal,
  };

  if (editingEntry) {
    entryData.id = editingEntry.id;
  }

  try {
    await db.saveEntry(entryData);

    const allEntries = await db.getEntriesForSeries(activeSeries.id);
    const tempSeries = structuredClone(activeSeries);
    tempSeries.summaryDisplay = calculateSeriesSummary(tempSeries, allEntries, format.duration);
    await db.saveSeries(tempSeries);

    dispatch('entry-saved', { entry: entryData, series: activeSeries, isNew: !editingEntry });
  } catch (error) {
    console.error('Error saving entry:', error);
  }
}

const EntryModal = {
  oninit({ attrs }) {
    // Support imperative open calls via attrs if needed
    if (attrs.entry && attrs.series) {
      openForEdit(attrs.entry, attrs.series);
    } else if (attrs.series) {
      openForNew(attrs.series);
    }
  },

  openForNew(series) {
    openForNew(series);
    toggleModal('entry-modal');
  },

  openForEdit(entry, series) {
    openForEdit(entry, series);
    toggleModal('entry-modal');
  },


  view({ attrs }) {
    const isTimeType = activeSeries?.type === 'time';
    const isEditing = !!editingEntry;

    const dispatch = (name, detail) => {
      document.querySelector('#entry-modal')?.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    };

    const close = () => { resetForm(); m.redraw(); };
    const handleSave = async () => { await saveEntry(dispatch); close(); };

    return m(ModalForm, {
        id: 'entry-modal',
        label: isEditing ? 'Edit Entry' : 'Add New Entry',
        onHide: () => { resetForm(); m.redraw();},
        onCancel: close,
        onAccept: handleSave,
        acceptLabel: 'Save Entry'
      },
      [
        m('wa-input', {
          label: 'Date & Time',
          placeholder: 'yyyy-MM-dd HH:mm:ss',
          autofocus: true,
          value: form.timestamp,
          oninput(e) { form.timestamp = e.target.value; },
        }),

        // Value — number
        !isTimeType && m('wa-number-input', {
          label: 'Value',
          step: 1,
          value: form.value,
          oninput(e) { form.value = e.target.value; },
        }),

        // Value — time (d/h/m/s)
        isTimeType && m('', [
          m('label', 'Value'),
          m(dhmsField, { dhms: form.dhms })
        ]),

        m('wa-input', {
          label: 'Notes (Optional)',
          value: form.notes,
          oninput(e) { form.notes = e.target.value; },
        }),
      ]
    );
  },
};


export default EntryModal;