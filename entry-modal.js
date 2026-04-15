import { formatDuration, secondsToDHMS, getFormattedISO } from './utils.js';
import { calculateSeriesSummary } from './analytics.js';
import { State, Actions } from './mithril-state-actions.js';
import dhmsField from './dhmsField.js'
import db from './db.js';
import ModalForm from './modal-form.js';

// Internal form state — lives outside the component so it survives redraws
// while the dialog is open, and is reset on open.
let form = {
  timestamp: '',
  value: '',
  notes: '',
  dhms: { d: 0, h: 0, m: 0, s: 0 },
};

let editingEntry = null;
let activeSeries = null;

function resetForm() {
  editingEntry = null;
  activeSeries = null;
  form = { timestamp: '', value: '', notes: '', dhms: { d: 0, h: 0, m: 0, s: 0 } };
}

function openForNew(series) {
  editingEntry = null;
  activeSeries = series;
  form = {
    timestamp: getFormattedISO(),
    value: '',
    notes: '',
    dhms: { d: 0, h: 0, m: 0, s: 0 },
  };
}

function openForEdit(entry, series) {
  editingEntry = entry;
  activeSeries = series;
  form = {
    timestamp: entry.timestamp,
    value: entry.value,
    notes: entry.notes || '',
    dhms: series.type === 'time' ? secondsToDHMS(entry.value) : { d: 0, h: 0, m: 0, s: 0 },
  };
}

async function saveEntry(dispatch) {
  if (!form.timestamp || !activeSeries) return;

  let finalVal;
  if (activeSeries.type === 'time') {
    const { d, h, m, s } = form.dhms;
    finalVal =
      (parseInt(d || 0) * 60*60*24) +
      (parseInt(h || 0) * 60*60) +
      (parseInt(m || 0) * 60) +
      parseInt(s || 0);
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
    const tempSeries = JSON.parse(JSON.stringify(activeSeries));
    tempSeries.summaryDisplay = calculateSeriesSummary(tempSeries, allEntries, formatDuration);
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
    document.querySelector('#entry-modal').toggleAttribute('open')
    m.redraw();
  },

  openForEdit(entry, series) {
    openForEdit(entry, series);
    document.querySelector('#entry-modal').toggleAttribute('open')
    m.redraw();
  },


  view({ attrs }) {
    const isTimeType = activeSeries?.type === 'time';
    const isEditing = !!editingEntry;

    const dispatch = (name, detail) => {
      const el = document.querySelector('#entry-modal');
      if (el) el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    };

    const close = () => {
      resetForm();
      m.redraw();
    };

    const handleSave = async () => {
      await saveEntry(dispatch);
      close();
      if (attrs['onentry-saved']) {
        // already fired via CustomEvent above; noop here
      }
    };

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
          value: form.timestamp,
          autofocus: true,
          oninput(e) { form.timestamp = e.target.value; },
          onkeydown(e) { if (e.key === 'Enter') handleSave(); },
        }),

        // Value — number
        !isTimeType && m('wa-number-input', {
          label: 'Value',
          value: form.value,
          step: 1,
          oninput(e) { form.value = e.target.value; },
        }),

        // Value — time (d/h/m/s)
        isTimeType && m('', [
          m('label', 'Value'),
          dhmsField(form.dhms)
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