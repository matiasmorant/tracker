import dhmsField from './dhmsField.js';
import { ColorPicker } from './color-picker.js';
import { toggleModal } from './utils.js';

const fieldComponents = new Map([
  ['datetime', DateTimeInput],
  ['number', NumberInput],
  ['text', 'wa-input'],
  ['dhms', dhmsField],
  ['select', 'wa-select'],
  ['color', ColorPicker],
]);

function ModalForm(config) {
  const {
    id,
    initState,
    onOpen,
    label,
    prepareData,
    save,
    onSave,
    onCancel,
    fields,
    extraAttrs = {},
  } = config;

  let state = initState();

  const getValue = (prop) => typeof prop === 'function' ? prop(state) : prop;

  const onAccept = async () => {
    const data = prepareData(state);
    if (data !== null) {
      const r = await save(state, data);
      if (r !== undefined) onSave?.(state, r);
      toggleModal(id);
    }
  };

  function Component() {
    return {
      view() {
        const currentExtraAttrs = getValue(extraAttrs);

        const children = getValue(fields).filter(Boolean).map((f, index) => {
          const { id: fieldId, label: fieldLabel, type, options, attrs: extra = {} } = f;
          if (index === 0) extra.autofocus = true;
          const value = state.form[fieldId];
          return m(fieldComponents.get(type), { label: fieldLabel, value, ...extra },
            type === 'select'
              ? (options ?? []).map(({ value, label }) => m('wa-option', { value }, label ?? value))
              : []
          );
        });

        const handleInput = (e) => { state.form[e.target.id] = e.target.value; };

        return m('wa-dialog[light-dismiss]', {
          id,
          label: getValue(label),
          onwa_after_hide: onCancel ? () => onCancel(state) : undefined,
          onwa_submit: e => e.preventDefault(),
          ...currentExtraAttrs,
        }, [
          m('form.wa-stack', { onsubmit(e) { e.preventDefault(); onAccept(); }, oninput: handleInput }, children),

          m('.wa-cluster.wa-justify-content-end[slot=footer]', [
            m([button, '.outlined[data-dialog=close]'], {
              onclick: onCancel ? () => onCancel(state) : undefined,
            }, 'Cancel'),

            m([button, '.brand.accent[data-dialog=close]'], {
              loading: currentExtraAttrs.loading || undefined,
              disabled: currentExtraAttrs.disabled || undefined,
              onclick: onAccept,
            }, currentExtraAttrs.acceptLabel ?? 'Ok'),
          ]),
        ]);
      },
    };
  }

  Component.open = async (args) => {
    state = { ...initState(), ...(await onOpen(args)) };
    toggleModal(id);
  };

  return Component;
}

export { ModalForm };