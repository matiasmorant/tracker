import { Duration } from './utils.js';

export default function dhmsField({ attrs: {value} }) {
  const duration = new Duration(value || 0);

  return {
    onbeforeupdate(vnode, old) {
      const { value } = vnode.attrs;
      // Only Sync internal duration if the external value changed to something different than what we have
      if (value !== old.attrs.value && value !== duration.toTotalSeconds()) {
        duration.fromTotalSeconds(value || 0);
      }
    },
    view({ attrs: { id, label: fieldLabel } }) {
      return m('', {id}, [
        fieldLabel && m('label', { style: 'display: block; margin-bottom: var(--wa-space-xs); font-size: var(--wa-font-size-s); font-weight: var(--wa-font-weight-medium);' }, fieldLabel),
        m('.wa-cluster', [
          ['d', 'Days',  null, null],
          ['h', 'Hours', 0, 23],
          ['m', 'Mins',  0, 59],
          ['s', 'Secs',  0, 59],
        ].map(([key, label, min, max]) =>
          m([NumberInput, '.max-w-24'], {
            label, min, max, value: duration[key],
            oninput(e) { 
              duration[key] = parseInt(e.target.value) || 0;
              const parent = e.currentTarget.parentElement;
              parent.value = duration.toTotalSeconds();
              parent.dispatchEvent(new Event('input', { bubbles: true }));
            },
          })
        )),
      ]);
    }
  };
}
