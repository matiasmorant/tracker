import dhmsField from './dhmsField.js'
import ModalForm from './modal-form.js'

const state = {
  open: false,
  d: 0, h: 0, m: 0, s: 0,
};

const DurationPickerModal = {
  state,
  toTotalSeconds() {
    return state.d * 86400 + state.h * 3600 + state.m * 60 + state.s;
  },
  fromTotalSeconds(totalSeconds) {
    const secs = parseInt(totalSeconds) || 0;
    state.d = Math.floor(secs / 86400);
    state.h = Math.floor((secs % 86400) / 3600);
    state.m = Math.floor((secs % 3600) / 60);
    state.s = secs % 60;
  },
  view() {
    return m(ModalForm, {
        id: "durationPickerModal",
        label: "Edit Duration",
        open: state.open,
        onHide: state.onCancel,
        onCancel: state.onCancel,
        onAccept: state.onAccept,
      },
      dhmsField(state)
    );
  },
};

export default DurationPickerModal;