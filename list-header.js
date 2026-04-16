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

        return m('.wa-split', [
            m('.wa-cluster', [
                m(icon`arrow-trend-up` + '.size-12.rounded-lg.text-white.text-2xl[style=background-color:var(--wa-color-brand-fill-loud)]'),
                m('h1.text-xl.font-bold.tracking-tight', 'Chronos'),
            ]),
            m('.wa-cluster', [
                m([button, '.filled'], { 'data-dialog': 'open group-dialog'  }, 'Groups'),
                m([button, '.brand.accent'], { 'data-dialog': 'open series-dialog' }, '+ New Series'),
                m('wa-dropdown', [
                    m([button, '.plain[slot=trigger]'], m(icon`ellipsis-vertical`)),
                    m('wa-dropdown-item[disabled]',
                        m('span.text-xs.font-bold.uppercase.tracking-widest', 'Transfer')
                    ),
                    m('wa-dropdown-item', { onclick: Actions.exportData }, [
                        m(icon`download`+'[slot=icon]'), 'Export JSON',
                    ]),
                    m('wa-dropdown-item', [
                        m(icon`upload`+'[slot=icon]'),
                        m('label.cursor-pointer',[
                            'Import JSON',
                            m('input.hidden[type=file][accept=.json]', {onchange: (e) => handleFile(e, 'json') })
                        ]),
                    ]),
                    m('wa-divider'),
                    m('wa-dropdown-item', { onclick: Actions.exportCSV }, [
                        m(icon`file-csv`+'[slot=icon]'), 'Export CSV',
                    ]),
                    m('wa-dropdown-item', [
                        m(icon`file-arrow-up`+'[slot=icon]'),
                        m('label.cursor-pointer',[
                            'Import CSV',
                            m('input.hidden[type=file][accept=.csv]', {onchange: (e) => handleFile(e, 'csv') })
                        ]),
                    ]),
                    m('wa-divider'),
                    m('wa-dropdown-item', { onclick: () => Actions.updateTheme(themeManager.toggleTheme()),}, [
                        m(icon(isLight ? 'moon' : 'sun')+'[slot=icon]'),
                        isLight ? 'Dark Theme' : 'Light Theme',
                    ]),
                ]),
            ]),
        ]);
    },
};

export default ListHeader;