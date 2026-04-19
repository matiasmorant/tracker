const dhmsField = {
  view({ attrs }) {
    const { dhms } = attrs;
    return m('.wa-cluster', [
      ['d', 'Days', null, null],
      ['h', 'Hours', 0, 23],
      ['m', 'Mins',  0, 59],
      ['s', 'Secs',  0, 59],
    ].map(([key, label, min, max]) =>
      m([NumberInput,'.max-w-24'], {
        label, min, max, value: dhms[key],
        oninput(e) { dhms[key] = parseInt(e.target.value) || 0; },
      })
    ));
  }
};

export default dhmsField;
