import { format } from './utils.js';
import DurationPickerModal from './duration-picker-modal.js';

const tableStyles = `
    #table-container .tabulator-row .tabulator-cell:first-child {
        border-left: none !important;
    }
    .dark #table-container .tabulator {
        background-color: transparent;
        border: none;
    }
    .tabulator-header {
        font-size: 1em !important;
    }
`;

function buildColumns(isTime, vnode) {
    return [
        {
            title: 'Date', field: 'timestamp', sorter: 'string',
            hozAlign: 'left', width: 180, resizable: false, editor: 'input'
        },
        {
            title: 'Value', field: 'value', hozAlign: 'right',
            width: 100, resizable: false,
            editor: isTime ? false : 'number',
            formatter: cell => isTime ? format.duration(cell.getValue()) : cell.getValue(),
            cellClick: (e, cell) => {
                if (isTime) {
                    e.stopPropagation();
                    DurationPickerModal.open({
                        duration: cell.getValue(),
                        onAccept: (value) => {
                            vnode.attrs.onEntryUpdated?.({ entry: { ...cell.getData(), value } });
                        },
                    });
                }
            }
        },
        {
            title: 'Notes', field: 'notes', editor: 'textarea',
            resizable: false,
            formatter: cell => cell.getValue() || '-'
        },
        {
            title: '', field: 'id', headerSort: false,
            hozAlign: 'right', width: 20, resizable: false,
            formatter: () => `<wa-button appearance="plain" variant="danger" size="small"><wa-icon name="trash-alt" label="Delete entry"></wa-icon></wa-button>`,
            cellClick: (e, cell) => {
                const entry = cell.getData();
                vnode.attrs.onDeleteEntryClick?.(entry);
            }
        }
    ];
}

function initTable(vnode) {
    const { series, entries = [] } = vnode.attrs;
    if (!series) return;

    const isTime = series.type === 'time';
    vnode.state.seriesId = series.id;

    vnode.state.table = new Tabulator(vnode.dom.querySelector('#table-container'), {
        data: [...entries].reverse(),
        layout: 'fitColumns',
        responsiveLayout: false,
        resizableColumns: false,
        resizableColumnFit: false,
        placeholder: 'No historical data available.',
        columns: buildColumns(isTime, vnode),
    });

    vnode.state.table.on('cellEdited', cell => {
        vnode.attrs.onEntryUpdated?.({ entry: cell.getData() });
    });
}

const SeriesHistory = {
    oncreate(vnode) {
        initTable(vnode);
    },

    onupdate(vnode) {
        if (!vnode.state.table) return;
        const { series, entries = [] } = vnode.attrs;

        if (series?.id !== vnode.state.seriesId) {
            vnode.state.table.destroy();
            initTable(vnode);
        } else {
            vnode.state.table.replaceData([...entries].reverse());
        }
    },

    onremove(vnode) {
        if (vnode.state.table) vnode.state.table.destroy();
    },

    view(vnode) {
        const { series, onAddEntryClick } = vnode.attrs;
        if (!series) return null;

        return m('.bg-white.rounded-2xl.shadow-sm.border.overflow-hidden.border-slate-200.dark:bg-slate-800.dark:border-slate-700', [
            m('style', tableStyles),
            m('.p-6.border-b.flex.justify-between.items-center.border-slate-100.dark:border-slate-700', [
                m('h3.text-lg.font-semibold.dark:text-slate-100', 'Data History'),
                m([button, '.brand.small'], {
                    onclick: () => onAddEntryClick?.({ series })
                }, [
                    m(icon`plus`),
                    'Add Entry'
                ])
            ]),
            m('#table-container.w-full')
        ]);
    }
};

export default SeriesHistory;
