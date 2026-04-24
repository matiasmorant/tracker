import dhmsField from './dhmsField.js';
import { ColorPicker } from './color-picker.js';
import { toggleModal } from './utils.js';

function makeModal(config) {
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

          const value   = state.form[fieldId];
          const oninput = (e) => { state.form[fieldId] = e.target.value; };

          switch (type) {
            case 'datetime': return m(DateTimeInput, { label: fieldLabel, value, oninput, ...extra });
            case 'number':   return m(NumberInput,   { label: fieldLabel, value, oninput, ...extra });
            case 'text':     return m('wa-input',    { label: fieldLabel, value, oninput, ...extra });
            case 'dhms':     return m(dhmsField,     { label: fieldLabel, value, oninput, ...extra });
            case 'select':   return m('wa-select',   { label: fieldLabel, value, onchange: oninput, ...extra },
              (options ?? []).map(opt =>
                m('wa-option', { value: opt.value }, opt.label ?? opt.value)
              ));
            case 'color':
              return m(ColorPicker, {
                selectedColor: value,
                onSelect: color => { state.form[fieldId] = color; },
                ...extra
              });
          }
        });

        return m('wa-dialog[light-dismiss]', {
          id,
          label:           getValue(label),
          onwa_after_hide: onCancel ? () => onCancel(state) : undefined,
          onwa_submit:     e => e.preventDefault(),
          ...currentExtraAttrs,
        }, [
          m('form.wa-stack', { onsubmit(e) { e.preventDefault(); onAccept(); } }, children),

          m('.wa-cluster.wa-justify-content-end[slot=footer]', [
            m([button, '.outlined[data-dialog=close]'], {
              onclick: onCancel ? () => onCancel(state) : undefined,
            }, 'Cancel'),

            m([button, '.brand.accent[data-dialog=close]'], {
              loading:  currentExtraAttrs.loading  || undefined,
              disabled: currentExtraAttrs.disabled || undefined,
              onclick:  onAccept,
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

export { makeModal };