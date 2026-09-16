const PeriodSelector = {
  view({ attrs: { settings, onSettingChange } }) {
    return m(".flex.gap-3.items-start.sm:items-center", [

      m(select, {
        value: settings.range,
        onchange: (e) => onSettingChange("range", e.target.value),
        options: [
          { value: "all",     label: "All Time" },
          { value: "day",     label: "Day" },
          { value: "week",    label: "Week" },
          { value: "month",   label: "Month" },
          { value: "quarter", label: "Quarter" },
          { value: "year",    label: "Year" },
          { value: "custom",  label: "Custom" },
        ],
      }),

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
return m(select, {
        value,
        onchange,
        options: [
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
        ],
      });
    }
};

export {PeriodSelector, StatSelect};