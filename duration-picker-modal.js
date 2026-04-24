import { ModalForm } from './modal-form.js';

const DurationPickerModal = ModalForm({
  id: 'durationPickerModal',
  initState: () => ({ form:   { duration: 0 }, onAccept: null, }),
  onOpen: ({ duration, onAccept }) => ({ form: { duration }, onAccept }),
  label: 'Edit Duration',
  prepareData: (state) => state.form.duration,
  save: (state, data) => data,
  onSave: (state, result) => state.onAccept?.(result),
  onCancel: (state) => { state.onAccept = null; },
  fields: [
    { id: 'duration', label: 'Value', type: 'dhms' },
  ],
});

export default DurationPickerModal;