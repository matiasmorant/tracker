import dhmsField from './dhmsField.js'
import ModalForm from './modal-form.js'
import { Duration } from './utils.js'

const state = {
  open: false,
  duration: new Duration()
};

const DurationPickerModal = {
  state,
  view() {
    return m(ModalForm, {
        id: "durationPickerModal",
        label: "Edit Duration",
        open: state.open,
        onHide: state.onCancel,
        onCancel: state.onCancel,
        onAccept: state.onAccept,
      },
      m(dhmsField, { dhms: state.duration })
    );
  },
};

export default DurationPickerModal;