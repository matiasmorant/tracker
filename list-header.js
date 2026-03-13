import { themeManager } from './theme-utils.js';
import { Actions } from './mithril-state-actions.js';
import chronosDB from './db.js';

const ListHeader = {
    oninit: () => themeManager.initTheme(),

    view() {
        const isLight = themeManager.getCurrentTheme() === 'light';

        const handleFile = async (e, type) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const content = await file.text();
                if (type === 'json') await chronosDB.importJSON(JSON.parse(content), true);
                else await chronosDB.importCSV(content);
                await Actions.loadSeries();
                Actions.showToast(`${type.toUpperCase()} imported`);
            } catch (err) { Actions.showToast(err.toString()); }
            e.target.value = '';
        };

        return m('div.wa-split', [
            m('div.wa-cluster', [
                m('wa-icon[name=arrow-trend-up].size-12.rounded-lg.text-white.text-2xl[style=background-color:var(--wa-color-brand-fill-loud)]'),
                m('h1.text-xl.font-bold.tracking-tight', 'Chronos'),
            ]),
            m('div.wa-cluster', [
                m('wa-button[appearance=filled]', { 'data-dialog': 'open group-dialog'  }, 'Groups'),
                m('wa-button[variant=brand]'    , { 'data-dialog': 'open series-dialog' }, '+ New Series'),
                m('wa-dropdown', [
                    m('wa-button[appearance=plain][slot=trigger]', m('wa-icon[name=ellipsis-vertical]')),
                    m('wa-dropdown-item[disabled]',
                        m('span.text-xs.font-bold.uppercase.tracking-widest', 'Transfer')
                    ),
                    m('wa-dropdown-item', { onclick: Actions.exportData }, [
                        m('wa-icon[name=download][slot=icon]'), 'Export JSON',
                    ]),
                    m('wa-dropdown-item', [
                        m('wa-icon[name=upload][slot=icon]'),
                        m('label.cursor-pointer',[
                            'Import JSON',
                            m('input.hidden[type=file][accept=.json]', {onchange: (e) => handleFile(e, 'json') })
                        ]),
                    ]),
                    m('wa-divider'),
                    m('wa-dropdown-item', { onclick: Actions.exportCSV }, [
                        m('wa-icon[slot=icon][name=file-csv]'), 'Export CSV',
                    ]),
                    m('wa-dropdown-item', [
                        m('wa-icon[slot=icon][name=file-arrow-up]'),
                        m('label.cursor-pointer',[
                            'Import CSV',
                            m('input.hidden[type=file][accept=.csv]', {onchange: (e) => handleFile(e, 'csv') })
                        ]),
                    ]),
                    m('wa-divider'),
                    m('wa-dropdown-item', { onclick: () => Actions.updateTheme(themeManager.toggleTheme()),}, [
                        m('wa-icon[slot=icon]', { name: isLight ? 'moon' : 'sun' }),
                        isLight ? 'Dark Theme' : 'Light Theme',
                    ]),
                ]),
            ]),
        ]);
    },
};

export default ListHeader;