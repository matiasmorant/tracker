const isSelected = (selectedIds, id) => selectedIds.some(sid => sid == id);

const sortBySelection = (items, selectedIds) =>
    [...items].sort((a, b) => isSelected(selectedIds, b.id) - isSelected(selectedIds, a.id));

const toggleSelection = (selectedIds, id, multi) => {
    if (isSelected(selectedIds, id)) {
        return selectedIds.filter(sid => sid != id);
    }
    return multi ? [...selectedIds, id] : [id];
};

const chipStyles = `
    .ms-chip {
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        background: oklch(from var(--chip-color) L C H / 0.1);
        border: 1px solid oklch(from var(--chip-color) L C H / 0.25);
        color: var(--chip-color);
    }
    .ms-chip.is-active {
        background-color: oklch(from var(--chip-color) L C H / 0.5);;
        border-color: transparent;
        color: oklch(from var(--chip-color) clamp(15%, calc((L - 0.5) * -1000%), 98%) C H);
        box-shadow: var(--wa-shadow-s);
    }
    .ms-chip:hover { filter: brightness(0.9); }
    .ms-chip:focus-visible { outline: 2px solid var(--wa-color-brand-fill-loud); }
`;


const Chip = '.ms-chip.rounded-full.border.px-3.py-1.text-xs.font-medium.transition-all.hover:-translate-y-px[role=button][tabindex=0]';

const MultiSelect = () => {
    let showAll = false;

    return {
        view({ attrs }) {
            const { items = [], selectedIds = [], multi = false, onchange } = attrs;

            const toggleItem = id => onchange?.(toggleSelection(selectedIds, id, multi));

            return m('.wa-cluster.gap-1', { class: attrs.class }, [
                m('style', chipStyles),

                m([button, '.plain.brand.small.min-w-6.p-0'], {
                    title:        showAll ? 'Show selected only' : 'Show all',
                    'aria-label': showAll ? 'Show selected only' : 'Show all',
                    onclick:      () => showAll = !showAll,
                }, m(icon(showAll ? 'minus' : 'plus'))),

                sortBySelection(items, selectedIds).map(item => {
                    const isActive = isSelected(selectedIds, item.id);
                    if (!isActive && !showAll) return null;

                    return m(Chip, {
                        class:         isActive ? 'is-active' : '',
                        style:         `--chip-color: ${item.color || '#64748b'}`,
                        'aria-pressed': isActive ? 'true' : 'false',
                        title:         isActive ? `Remove ${item.label}` : `Add ${item.label}`,
                        onclick:       () => toggleItem(item.id),
                        onkeydown(e) {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            toggleItem(item.id);
                        },
                    }, item.label);
                }),
            ]);
        }
    };
};

export default MultiSelect;
export { isSelected, sortBySelection, toggleSelection };
