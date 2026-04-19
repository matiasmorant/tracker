import dhmsField from './dhmsField.js';
import { ColorPicker } from './color-picker.js';
import { toggleModal } from './utils.js';

const ModalForm = {
  view({ attrs }) {
    const {
      form,
      fields = [],
      id,
      label,
      open,
      prepareData,
      save,
      onSave,
      onCancel,
      acceptLabel = 'Ok',
      loading = false,
      disabled = false,
      onHide,
      ...restAttrs
    } = attrs;

    const onAccept = async () => {
      const data = prepareData();
      if (data !== null) {
        const r = await save(data);
        if (r !== undefined) onSave?.(r);
        toggleModal(id);
      }
    };

    const children = fields.filter(Boolean).map((f, index) => {
      const { id: fieldId, label: fieldLabel, type, options, attrs: extra = {} } = f;
      
      if (index === 0) extra.autofocus = true;

      const value = form[fieldId];
      const oninput = (e => { form[fieldId] = e.target.value; });

      switch (type) {
        case 'datetime' : return m(DateTimeInput , { label: fieldLabel, value, oninput, ...extra });
        case 'number'   : return m(NumberInput   , { label: fieldLabel, value, oninput, ...extra });
        case 'text'     : return m('wa-input'    , { label: fieldLabel, value, oninput, ...extra });
        case 'dhms'     : return m(dhmsField     , { label: fieldLabel, value, oninput, ...extra });
        case 'select'   : return m('wa-select'   , { label: fieldLabel, value, onchange: oninput, ...extra },
          (options ?? []).map(opt =>
            m('wa-option', { value: opt.value }, opt.label ?? opt.value)
          ));

        case 'color':
          return m(ColorPicker, {
              selectedColor: value,
              onSelect: color => { form[fieldId] = color; },
              ...extra
            });
      }
    });

    return m('wa-dialog[light-dismiss]', {
      id,
      label,
      open: open || undefined,
      onwa_after_hide: onHide,
      onwa_submit: e => e.preventDefault(),
      ...restAttrs
    }, [
      m('form.wa-stack', { onsubmit(e) { e.preventDefault(); onAccept(); } }, children),

      // Footer
      m('.wa-cluster.wa-justify-content-end[slot=footer]', [
        m([button, '.outlined[data-dialog=close]'], {
          onclick: onCancel
        }, 'Cancel'),
        
        m([button, '.brand.accent[data-dialog=close]'], {
          loading:  loading  || undefined,
          disabled: disabled || undefined,
          onclick:  onAccept
        }, acceptLabel),
      ])
    ]);
  }
};

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

  function Component() {
    let state = initState();

    Component.open = async (args) => {
      state = { ...initState(), ...(await onOpen(args)) };
      toggleModal(id);
    };

    const getValue = (prop) => typeof prop === 'function' ? prop(state) : prop;

    return {
      view() {
        return m(ModalForm, {
          id,
          label:       getValue(label),
          form:        state.form,
          prepareData: ()       => prepareData(state),
          save:        (data)   => save(state, data),
          onSave:      (result) => onSave?.(state, result),
          onCancel:    onCancel ? () => onCancel(state) : undefined,
          fields:      getValue(fields),
          ...getValue(extraAttrs),
        });
      },
    };
  }

  return Component;
}

export { makeModal };
