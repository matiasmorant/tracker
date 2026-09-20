import { format } from './utils.js';
import { startOfMonth, endOfMonth, getDate, getDay, getDaysInMonth, subDays, addDays, subMonths, addMonths, isToday as dateFnsIsToday } from 'date-fns';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function createDayObj(date, isCurrentMonth, entries) {
    const dateString = format.day(date);
    return {
        date,
        dateString,
        day: getDate(date),
        isCurrentMonth,
        isToday: dateFnsIsToday(date),
        entries: entries.filter(e => e.timestamp && e.timestamp.startsWith(dateString)),
    };
}

function buildCalendarDays(calendarDate, entries) {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd   = endOfMonth(calendarDate);
    const startDay   = getDay(monthStart);
    const daysInMonth = getDaysInMonth(calendarDate);
    const prevMonthStart = subDays(monthStart, startDay);
    const totalCells = 42;

    return [
    ..._.times(startDay, i => createDayObj(addDays(prevMonthStart, i), false, entries)),
    ..._.times(daysInMonth, i => createDayObj(addDays(monthStart, i), true, entries)),
    ..._.times(totalCells - (startDay + daysInMonth), i => createDayObj(addDays(monthEnd, i + 1), false, entries))
    ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DayEntries = {
    view({ attrs: { day, currentSeries } }) {
        if (day.entries.length === 0) return null;

        const isTimeSeries = currentSeries && currentSeries.type === 'time';

        if (day.entries.length === 1) {
            const displayValue = isTimeSeries
                ? format.duration(day.entries[0].value)
                : day.entries[0].value;
            return m('.text-center.text-brand.font-black.text-lg', displayValue );
        }

        return m('.wa-stack.gap-1.overflow-y-auto.custom-scrollbar',
            day.entries.map(entry => {
                const displayValue = isTimeSeries ? format.duration(entry.value) : entry.value;
                return m('wa-badge[variant=brand][appearance=outlined].w-full.cursor-pointer.text-xs.hover:opacity-80.transition-opacity',
                    {  style: '--wa-border-radius-small: 4px;', },
                    displayValue
                );
            })
        );
    },
};

const CalendarDay = {
    view({ attrs: { day, currentSeries, onDayClick } }) {

        return m('.wa-stack.gap-1.h-32.p-2.cursor-pointer.hover:surface-lowered',
            { 'data-date': day.dateString,
              class: day.isCurrentMonth ? 'surface-raised' : 'surface-default opacity-50',
              onclick: () => onDayClick(day), },
            m('span.text-xs.w-fit',
                { class: day.isToday
                    ? 'bg-brand text-white rounded-full p-1 font-bold'
                    : 'font-medium text-normal', },
                day.day
            ),
            m(DayEntries, { day, currentSeries })
        );
    },
};

// ---------------------------------------------------------------------------
// Main Calendar component
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Calendar
 *
 * Attrs:
 *   calendarDate  {Date}     – month to display (default: today)
 *   entries       {Array}    – array of entry objects with `timestamp` and `value`
 *   series        {Object}   – current series descriptor (e.g. { type: 'time' })
 *   onDayClick    {Function} – called with { date, dateString, entries, formattedDate }
 */
const Calendar = {
    oninit({ attrs, state }) {
        state.calendarDate = attrs.calendarDate ? new Date(attrs.calendarDate) : new Date();
    },

    view({ attrs, state }) {
        const entries       = attrs.entries  ?? [];
        const currentSeries = attrs.series   ?? null;
        const onDayClick    = attrs.onDayClick;

        const days      = buildCalendarDays(state.calendarDate, entries);
        const monthName = format.month(state.calendarDate);

        const handleDayClick = (day) => {
            onDayClick?.({
                date:          day.date,
                dateString:    day.dateString,
                entries:       day.entries,
                formattedDate: format.dateTime(day.date),
            });
        };

        return m('.surface-raised.shadow-md.overflow-hidden',

            // Header
            m('.wa-split.items-center.p-4.surface-quiet.border-(b-solid b slate-100).dark:border-slate-700',
                m(h2, monthName),
                m('wa-button-group',
                    m([button, '.brand.small'],
                        { onclick: () => { state.calendarDate = subMonths(state.calendarDate, 1); }, },
                        m(icon`chevron-left`)
                    ),
                    m([button, '.brand.small'],
                        { onclick: () => { state.calendarDate = addMonths(state.calendarDate, 1); }, },
                        m(icon`chevron-right`)
                    )
                )
            ),

            // Day-of-week headers
            m('.grid.grid-cols-7.border-b.border-slate-100.dark:border-slate-700',
                DAYS_OF_WEEK.map(day =>
                    m('.py-3.text-center.text-xs.font-bold.text-quiet.uppercase.tracking-widest',
                        day
                    )
                )
            ),

            // Day grid
            m('.grid.grid-cols-7.gap-px.bg-slate-100.dark:bg-slate-700.border-b.border-r.border-slate-100.dark:border-slate-700',
                days.map(day =>
                    m(CalendarDay, {
                        key:        day.dateString,
                        day,
                        currentSeries,
                        onDayClick: handleDayClick,
                    })
                )
            )
        );
    },
};

export default Calendar;