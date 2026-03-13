import { State, Actions } from './mithril-state-actions.js';
import chronosDB from './db.js';

const DetailHeader = {
    oninit(vnode) {
        vnode.state.nameValue = State.currentSeries?.name ?? "";
        vnode.state.prevSeries = State.currentSeries;
    },

    onupdate(vnode) {
        if (State.currentSeries !== vnode.state.prevSeries) {
            vnode.state.prevSeries = State.currentSeries;
            vnode.state.nameValue = State.currentSeries?.name ?? "";
        }
    },

    view(vnode) {
        const series = State.currentSeries;
        if (!series) return null;

        const commitName = async () => {
            const trimmed = vnode.state.nameValue.trim();
            if (!trimmed) return;
            await chronosDB.saveSeries({ ...series, name: trimmed });
            await Actions.loadSeries();
        };

        return m(".wa-cluster", [
            m('wa-button[appearance=plain]', {onclick: ()=>{ State.view = 'list'; }},
                m("wa-icon[name=chevron-left]")),
            m("wa-input.series-name-input.text-l[type=text]", {
                value: vnode.state.nameValue,
                oninput: (e) => { vnode.state.nameValue = e.target.value; },
                onchange: commitName,
                onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); },
            }, m("wa-icon[name=pen][slot=end]")),
            m('wa-button[appearance=plain]',{
                onclick: async () => {
                    if (!confirm('Delete series and all data?')) return;
                    await chronosDB.deleteSeries(series.id);
                    await Actions.loadSeries();
                    State.view = 'list';
                    m.redraw();
                },
            },m("wa-icon[name=trash-can]")),
        ]);
    },
};

export default DetailHeader;