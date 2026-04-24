export const COLORS = [
  '#6366f1', '#ec4899', '#f43f5e', '#f59e0b',
  '#10b981', '#06b6d4', '#8b5cf6', '#475569',
  '#94a3b8', '#14b8a6', '#f97316', '#ef4444',
];

export const DEFAULT_COLOR = '#6366f1';

export const ColorPicker = {
  view(vnode) {
    const { value, oninput } = vnode.attrs;
    
    return m('.grid.grid-cols-6.wa-gap-2xs',
      COLORS.map(color =>
        m([icon`square`,'.text-5xl'], {
          style: [
            `color: ${color}`,
            color === value
              ? `box-shadow: 0 0 0 2px var(--wa-color-surface-default), 0 0 0 4px ${color}`
              : '',
          ].filter(Boolean).join('; '),
          onclick() {
            oninput({ target: { id: vnode.attrs.id, value: color } });
          },
        })
      )
    );
  }
};
