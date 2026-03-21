const PeriodSelector = {
  view({ attrs: { settings, onSettingChange } }) {
    return m(".flex.gap-3.items-start.sm:items-center", [

      m("wa-select[size=small].w-28", {
        value: settings.range,
        onchange: (e) => onSettingChange("range", e.target.value),
      }, [
        m("wa-option[value=all]",     "All Time"),
        m("wa-option[value=day]",     "Day"),
        m("wa-option[value=week]",    "Week"),
        m("wa-option[value=month]",   "Month"),
        m("wa-option[value=quarter]", "Quarter"),
        m("wa-option[value=year]",    "Year"),
        m("wa-option[value=custom]",  "Custom"),
      ]),

      settings.range === "custom"
        ? m("[placeholder=Days].flex.items-center.space-x-1", [
            m("wa-input[type=number][size=small].w-14.part-base:px-1", {
              value: settings.customDays,
              oninput: (e) => onSettingChange("customDays", e.target.value),
            }),
            m("span.text-xs.font-bold.text-quiet.uppercase.tracking-tight", "Days"),
          ])
        : null,

    ]);
  }
};


const StatSelect = {
    view({ attrs: { value, onchange } }) {
        return m(`wa-select[size=small].w-30`, { value, onchange },
          [
            { value: 'mean',    label: 'Mean' },
            { value: 'dayMean', label: 'Daily Avg' },
            { value: 'sum',     label: 'Sum' },
            { value: 'count',   label: 'Count' },
            { value: 'min',     label: 'Min' },
            { value: 'q1',      label: 'Q1' },
            { value: 'median',  label: 'Median' },
            { value: 'q3',      label: 'Q3' },
            { value: 'max',     label: 'Max' },
            { value: 'first',   label: 'First' },
            { value: 'last',    label: 'Last' },
        ].map(op => m(`wa-option[value=${op.value}]`, op.label))
      );
    }
};

export {PeriodSelector, StatSelect};