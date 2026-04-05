import dhmsField from './dhmsField.js'

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
  state.d    = Math.floor(secs / 86400);
  state.h   = Math.floor((secs % 86400) / 3600);
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
    return m("wa-dialog#durationPickerModal",{
        label: "Edit Duration",
        open: state.open || undefined,
        "light-dismiss": true,
        onwa_after_hide() { if (_reject) cancel(); },
      },
      [
        dhmsField(state),
        m(".wa-cluster.wa-justify-content-end", { slot: "footer"}, [
          m([button, ".outlined"], { onclick: cancel  }, "Cancel"),
          m([button, ".brand"],    { onclick: confirm }, "OK"),
        ]),
      ]
    );
  },
};

export default DurationPickerModal;