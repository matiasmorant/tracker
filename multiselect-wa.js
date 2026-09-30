const optionTag = (option, color) => {
  const remove = event => {
    event.stopPropagation();
    event.currentTarget.dispatchEvent(new CustomEvent('wa-remove', { bubbles: true, composed: true }));
  };

  const container = document.createElement('div');
  m.render(
    container,
    m('wa-tag[part=tag][pill][role=button][size=s][title=Remove][tabindex=0].cursor-pointer', {
      'data-value': option.value,
      style: color
        ? `background-color:oklch(from ${color} L C H / 0.5);border-color:transparent;color:oklch(from ${color} clamp(15%, calc((L - 0.5) * -1000%), 98%) C H)`
        : '',
      onmousedown: e => e.stopPropagation(),
      onclick: remove,
      onkeydown: e => {
        if (e.key === 'Enter' || e.key === ' ') remove(e);
      },
    }, option.label)
  );

  return container.firstElementChild;
};

// wa-select keeps its value as a property, so it has to be pushed in once the
// element exists (and refreshed on every update)
const sync = (dom, { options = [], selectedIds = [] }) => {
  const colors = new Map(options.map(({ value, color }) => [value, color]));

  dom.getTag = option => optionTag(option, colors.get(option.value));
  dom.value   = [...selectedIds];
};

const MultiSelectWa = {
  oncreate({ dom, attrs }) { sync(dom, attrs); },
  onupdate({ dom, attrs }) { sync(dom, attrs); },

  view({ attrs }) {
    const { options = [], selectedIds = [], onchange, maxOptionsVisible, ...rest } = attrs;

    return m([select, '[multiple][appearance=filled].w-auto'], {
      ...rest,
      'max-options-visible': maxOptionsVisible ?? 20,
      onchange: e => onchange?.([...e.target.value]),
      options,
    });
  },
};

export default MultiSelectWa;
