const dhmsField = (dhms)=>m('.wa-cluster', [
            ['d', 'Days', null, null],
            ['h', 'Hours', 0, 23],
            ['m', 'Mins',  0, 59],
            ['s', 'Secs',  0, 59],
          ].map(([key, lbl, min, max]) =>
            m('wa-number-input', {
              style: 'max-width: 6rem',
              label: lbl,
              value: dhms[key],
              min,
              max,
              step: 1,
              oninput(e) { dhms[key] = parseInt(e.target.value) || 0; },
            })
          ))
export default dhmsField;