import db from './db.js';
import ModalForm from './modal-form.js';

// SeriesModal
//
// Attrs:
//   series      {object|null} - series to edit, or null to create new
//   onSave      {function} - called with ({ series, isNew })

const SeriesModal = {
  oninit(vnode) {
    this.groups = [];
    this.form = this.formFromSeries(vnode.attrs.series);

    db.getAllGroups()
      .then(groups => {
        this.groups = groups.slice().sort((a, b) => a.name.localeCompare(b.name));
        m.redraw();
      })
      .catch(err => console.error('Error loading groups:', err));
  },

  onupdate(vnode) {
    // When the series prop changes (e.g. switching from edit to new), reset the form.
    const incoming = vnode.attrs.series;
    const current = this._lastSeries;
    if (incoming !== current) {
      this._lastSeries = incoming;
      this.form = this.formFromSeries(incoming);
    }
  },

  formFromSeries(series) {
    this._lastSeries = series;
    if (series) {
      return {
        name: series.name || '',
        type: series.type || 'number',
        group: series.group || '',
        config: series.config || { summaryMetrics: [], summaries: [], quickAddAction: 'manual' },
      };
    }
    return {
      name: '',
      type: 'number',
      group: '',
      config: { summaryMetrics: [], summaries: [], quickAddAction: 'manual' },
    };
  },

  async save(vnode) {
    const { series, onSave } = vnode.attrs;

    if (!this.form.name.trim()) return;

    const seriesData = {
      ...(series ? { id: series.id } : {}),
      name: this.form.name.trim(),
      type: this.form.type,
      group: this.form.group,
      config: { ...this.form.config },
    };

    try {
      await db.saveSeries(seriesData);
      onSave?.({ series: seriesData, isNew: !series });
    } catch (err) {
      console.error('Error saving series:', err);
    }
  },

  view(vnode) {
    const { series } = vnode.attrs;
    const isEditing = Boolean(series);
    const label = isEditing ? 'Edit Series' : 'Create New Series';

    return m(ModalForm, {
      id: 'series-dialog',
      label,
      onAccept: () => this.save(vnode),
      acceptLabel: isEditing ? 'Save Changes' : 'Save Series',
      disabled: !this.form.name.trim()
    }, [
      
      m('wa-input', {
        label: 'Name',
        placeholder: 'Series name',
        value: this.form.name,
        autofocus: true,
        oninput: e => { this.form.name = e.target.value; },
      }),

      m('wa-select', {
        label: 'Type',
        value: this.form.type,
        onchange: e => { this.form.type = e.target.value; },
      }, [
        m('wa-option', { value: 'number' }, 'Number'),
        m('wa-option', { value: 'time' }, 'Time'),
      ]),

      m('wa-select', {
        label: 'Group',
        value: this.form.group || '',
        onchange: e => { this.form.group = e.target.value; },
      }, [
        m('wa-option', { value: '' }, ''),
        ...this.groups.map(g =>
          m('wa-option', { value: g.name }, g.name)
        ),
      ]),

    ]);
  },
};

export default SeriesModal;
