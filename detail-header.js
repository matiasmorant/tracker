import { State, Actions } from './mithril-state-actions.js';
import chronosDB from './db.js';

const DetailHeader = {
    oninit({state}) {
        state.nameValue = State.currentSeries?.name ?? "";
        state.prevSeries = State.currentSeries;
    },

    onupdate({state}) {
        if (State.currentSeries !== state.prevSeries) {
            state.prevSeries = State.currentSeries;
            state.nameValue = State.currentSeries?.name ?? "";
        }
    },

    view({state}) {
        const series = State.currentSeries;
        if (!series) return null;

        const commitName = async () => {
            const trimmed = state.nameValue.trim();
            if (!trimmed) return;
            await chronosDB.series.put({ ...series, name: trimmed });
            await Actions.loadSeries();
        };

        return m(".wa-cluster", [
            m([button, '.plain'], {onclick: ()=>{ State.view = 'list'; }},
                m(icon`chevron-left`)),
            m("wa-input.series-name-input.text-l[type=text]", {
                value: state.nameValue,
                oninput: (e) => { state.nameValue = e.target.value; },
                onchange: commitName,
                onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); },
            }, m(icon`pen`+'[slot=end]')),
            m([button, '.plain'],{
                onclick: async () => {
                    if (!confirm('Delete series and all data?')) return;
                    await chronosDB.deleteSeries(series.id);
                    await Actions.loadSeries();
                    State.view = 'list';
                    m.redraw();
                },
            },m(icon`trash-can`)),
        ]);
    },
};

export default DetailHeader;