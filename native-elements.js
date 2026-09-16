window.h2='h2.text-lg.font-bold';
window.h3='h3.text-xs.text-quiet.uppercase.font-black.tracking-widest';
window.h4='h4.text-xs.text-quiet.uppercase.font-bold.tracking-wide';
window.icon=(name)=>`wa-icon[name=${name}]`

const classAttrs = {
  appearance : ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'],
  size       : ['small', 'medium', 'large'],
  variant    : ['neutral', 'brand', 'success', 'warning', 'danger'],
}

function parseWaClasses(attrs) {
  const classes = _.words(attrs.class, /[^.\s]+/g);
  const extracted = _.mapValues(classAttrs, (v, k) => attrs[k] ?? _.intersection(classes, v)[0] );
  return _.omitBy({
    ...attrs,
    ...extracted,
    class: _.difference(classes, ...Object.values(classAttrs)).join(' ')
  }, _.isUndefined);
}

const slotFirstIcon = (children, slotName) => {
  const kids = Array.isArray(children) ? children : [children];
  if (kids.length > 1 && kids[0]?.tag === 'wa-icon') {
    kids[0].attrs = { ...kids[0].attrs, slot: slotName };
  }
  return kids;
};

window.button = {
  view: ({ attrs, children }) => {
    const waAttrs = parseWaClasses(attrs);
    const kids = slotFirstIcon(children, 'start');
    if (kids.length > 1 && kids.at(-1)?.tag === 'wa-icon') {
      kids.at(-1).attrs = { ...kids.at(-1).attrs, slot: 'end' };
    }
    return m('wa-button', waAttrs, kids);
  }
};

window.callout = {
  view: ({ attrs, children }) => {
    const waAttrs = parseWaClasses(attrs);
    const kids = slotFirstIcon(children, 'icon');
    return m('wa-callout', waAttrs, kids);
  }
};

window.select = {
  view: ({ attrs, children }) => {
    const { options, class: className = '', ...rest } = attrs;
    const classes = _.words(className, /[^.\s]+/g);

    const width = classes.find(c => c.startsWith('w-')) || 'w-28';
    const size = classes.find(c => classAttrs.size.includes(c)) || 'small';
    const remaining = classes.filter(c => c !== width && !classAttrs.size.includes(c));

    const kids = options
      ? options.map(op => m('wa-option', { value: op.value }, op.label ?? op.value))
      : children;

    return m('wa-select', { ...rest, size, class: [width, ...remaining].join(' ') }, kids);
  }
};

window.section = {
  view: ({ attrs, children }) => {
    const { title, icon: iconName, ...restAttrs } = attrs;
    return m('wa-card', restAttrs, [
      m('.wa-cluster[slot=header]', [
        iconName && m(icon(iconName) + '.text-brand'),
        m(h3, title),
      ]),
      children,
    ]);
  }
};

window.field = {
  view: ({ attrs, children }) => {
    const { label, ...rest } = attrs;
    return m('.wa-stack.gap-1\\.5', rest, [
      label && m(h4, label),
      children,
    ]);
  }
};

window.DateTimeInput = 'wa-input[placeholder="yyyy-MM-dd HH:mm:ss"]';
window.NumberInput = 'wa-number-input[step=1]';
