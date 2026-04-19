window.h3='h3.text-xs.text-quiet.uppercase.font-black.tracking-widest';
window.h4='h4.text-xs.text-quiet.uppercase.font-bold.tracking-wide';
window.icon=(name)=>`wa-icon[name=${name}]`
window.button = {
  view: ({attrs, children})=>{
    const classes = (attrs.class || '').split(/[\s\.]+/).filter(Boolean);
    const waAttrs = { ...attrs };

	const appearances = ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'];
	const sizes = ['small', 'medium', 'large'];
	const variants = ['neutral', 'brand', 'success', 'warning', 'danger'];

    const remainingClasses = [];

    classes.forEach(c => {
      if      (appearances.includes(c)) waAttrs.appearance = c;
      else if (sizes      .includes(c)) waAttrs.size       = c;
      else if (variants   .includes(c)) waAttrs.variant    = c;
      else                              remainingClasses.push(c);
    });

    if (remainingClasses.length) waAttrs.class = remainingClasses.join(' ');
    else delete waAttrs.class;

    const kids = (Array.isArray(children) ? children : [children]);

    if (kids.length > 1) {
      const first = kids[0];
      const last = kids.at(-1);
      if (first?.tag === 'wa-icon'){ first.attrs = { ...first.attrs, slot: 'start' }; }
      if (last ?.tag === 'wa-icon'){ last .attrs = { ...last .attrs, slot: 'end'   }; }
    }

    return m('wa-button', waAttrs, kids);
  }
};

window.callout = {
  view: ({attrs, children})=>{
    const classes = (attrs.class || '').split(/[\s\.]+/).filter(Boolean);
    const waAttrs = { ...attrs };

    const appearances = ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'];
    const sizes = ['small', 'medium', 'large'];
    const variants = ['neutral', 'brand', 'success', 'warning', 'danger'];

    const remainingClasses = [];

    classes.forEach(c => {
      if      (appearances.includes(c)) waAttrs.appearance = c;
      else if (sizes      .includes(c)) waAttrs.size       = c;
      else if (variants   .includes(c)) waAttrs.variant    = c;
      else                              remainingClasses.push(c);
    });

    if (remainingClasses.length) waAttrs.class = remainingClasses.join(' ');
    else delete waAttrs.class;

    const kids = (Array.isArray(children) ? children : [children]);

    if (kids.length > 1) {
      const first = kids[0];
      if (first?.tag === 'wa-icon'){ first.attrs = { ...first.attrs, slot: 'icon' }; }
    }

    return m('wa-callout', waAttrs, kids);
  }
};

window.DateTimeInput = 'wa-input[placeholder="yyyy-MM-dd HH:mm:ss"]'
window.NumberInput = 'wa-number-input[step=1]'