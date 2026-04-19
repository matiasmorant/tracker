import { format } from './utils.js';
import { startOfMonth, endOfMonth, getDate, getDay, getDaysInMonth, subDays, addDays, subMonths, addMonths, isToday as dateFnsIsToday } from 'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm';

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
    const days = [];

    // Previous-month filler
    const prevMonthStart = subDays(monthStart, startDay);
    for (let i = 0; i < startDay; i++) {
        days.push(createDayObj(addDays(prevMonthStart, i), false, entries));
    }

    // Current month
    for (let i = 0; i < daysInMonth; i++) {
        days.push(createDayObj(addDays(monthStart, i), true, entries));
    }

    // Next-month filler (6-week grid = 42 cells)
    const totalCells = 42;
    for (let i = 1; i <= totalCells - days.length; i++) {
        days.push(createDayObj(addDays(monthEnd, i), false, entries));
    }

    return days;
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
            return m('.flex-1.flex.items-center.justify-center.text-brand.font-black.text-lg.hover:surface-lowered.rounded-lg.transition-colors',
                displayValue
            );
        }

        return m('.space-y-1.overflow-y-auto.max-h-20.custom-scrollbar',
            day.entries.map(entry => {
                const displayValue = isTimeSeries ? format.duration(entry.value) : entry.value;
                return m('wa-badge[variant=brand][appearance=outlined].w-full',
                    { 
                        style: 'font-size: 10px; cursor: pointer; --wa-border-radius-small: 4px;',
                        class: 'hover:opacity-80 transition-opacity'
                    },
                    displayValue
                );
            })
        );
    },
};

const CalendarDay = {
    view({ attrs: { day, currentSeries, onDayClick } }) {
        const baseClass = day.isCurrentMonth
            ? 'surface-raised'
            : 'surface-default text-quiet opacity-50';

        return m('.h-32.border-b.border-r.border-slate-100.p-2.cursor-pointer.hover:surface-lowered.dark:border-slate-700',
            { 'data-date': day.dateString,
              class: baseClass,
              onclick: () => onDayClick(day), },
            m('span',
                { class: day.isToday
                    ? 'bg-brand text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold'
                    : 'text-xs font-medium text-normal', },
                day.day
            ),
            m('.mt-2.flex-1.flex.flex-col.min-h-0',
                m(DayEntries, { day, currentSeries })
            )
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

        return m('.surface-raised.rounded-2xl.shadow-sm.border.border-slate-200.overflow-hidden.dark:border-slate-700',

            // Header
            m('.p-4.border-b.border-slate-100.flex.items-center.justify-between.bg-slate-50\\/50.dark:border-slate-700.dark:bg-slate-800\\/50',
                m('.wa-split.items-center',
                    m('h3.text-lg.font-bold.text-normal', monthName),
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
            m('.grid.grid-cols-7',
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