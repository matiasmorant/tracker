import dhmsField from './dhmsField.js'
import ModalForm from './modal-form.js'

// DurationPickerModal
//
// Usage:
//   const seconds = await DurationPickerModal.open(initialSeconds);
//
let _resolve = null;
let _reject = null;

const state = {
  open: false,
  d: 0, h: 0, m: 0, s: 0,
};

function fromTotalSeconds(totalSeconds) {
  const secs = parseInt(totalSeconds) || 0;
  state.d = Math.floor(secs / 86400);
  state.h = Math.floor((secs % 86400) / 3600);
  state.m = Math.floor((secs % 3600) / 60);
  state.s = secs % 60;
}

function toTotalSeconds() {
  return state.d * 86400 + state.h * 3600 + state.m * 60 + state.s;
}

function confirm() {
  state.open = false;
  const resolve = _resolve;
  _resolve = null;
  _reject = null;
  resolve?.(toTotalSeconds());
}

function cancel() {
  state.open = false;
  const reject = _reject;
  _resolve = null;
  _reject = null;
  reject?.(new Error("Cancelled"));
}

const DurationPickerModal = {
  open(initialSeconds) {
    fromTotalSeconds(initialSeconds);
    state.open = true;
    m.redraw();
    return new Promise((resolve, reject) => {
      _resolve = resolve;
      _reject  = reject;
    });
  },

  view() {
    return m(ModalForm, {
        id: "durationPickerModal",
        label: "Edit Duration",
        open: state.open,
        onHide() { if (_reject) cancel(); },
        onCancel: cancel,
        onAccept: confirm,
        closeOnAccept: false // the function 'confirm' handles closing
      },
      dhmsField(state)
    );
  },
};

export default DurationPickerModal;