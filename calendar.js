import { formatMonth, formatDuration, prevMonth, nextMonth, getFormattedISO } from './utils.js';
import { format, startOfMonth, endOfMonth, getDate, getDay, getMonth, getYear, getDaysInMonth,subDays,addDays,isSameDay,isSameMonth,isToday as dateFnsIsToday} from 'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm';

class CalendarComponent extends HTMLElement {
    constructor() {
        super();
        // Initialize internal state
        this._calendarDate = new Date();
        this._entries = [];
        this._currentSeries = null;
        
        // Bind methods
        this.handleDayClick = this.handleDayClick.bind(this);
        this.navigatePrevMonth = this.navigatePrevMonth.bind(this);
        this.navigateNextMonth = this.navigateNextMonth.bind(this);
    }
    
    connectedCallback() {
        this.render();
    }
    
    static get observedAttributes() {
        return ['entries', 'series'];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'entries' && newValue) {
            try {
                this._entries = JSON.parse(newValue);
            } catch (e) {
                console.error('Failed to parse entries:', e);
                this._entries = [];
            }
        } else if (name === 'series' && newValue) {
            try {
                this._currentSeries = JSON.parse(newValue);
            } catch (e) {
                console.error('Failed to parse series:', e);
                this._currentSeries = null;
            }
        }
        this.render();
    }
    
    // Getters and setters for properties
    get calendarDate() {
        return this._calendarDate;
    }
    
    set calendarDate(value) {
        this._calendarDate = new Date(value);
        this.render();
    }
    
    get entries() {
        return this._entries;
    }
    
    set entries(value) {
        this._entries = value;
        this.render();
    }
    
    get series() {
        return this._currentSeries;
    }
    
    set series(value) {
        this._currentSeries = value;
        this.render();
    }
    
    // Calendar logic methods
    createDayObj(date, isCurrentMonth) {
        const dateString = format(date, 'yyyy-MM-dd');
        const isToday = dateFnsIsToday(date);
        
        return {
            date: date,
            dateString: dateString,
            day: getDate(date),
            isCurrentMonth: isCurrentMonth,
            isToday: isToday,
            entries: this._entries.filter(e => e.timestamp && e.timestamp.startsWith(dateString))
        };
    }
    
    get calendarDays() {
        const currentDate = this._calendarDate;
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDay = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
        const daysInMonth = getDaysInMonth(currentDate);
        
        const days = [];
        
        // Previous month days
        const prevMonthStart = subDays(monthStart, startDay);
        for (let i = 0; i < startDay; i++) {
            const date = addDays(prevMonthStart, i);
            days.push(this.createDayObj(date, false));
        }
        
        // Current month days
        for (let i = 0; i < daysInMonth; i++) {
            const date = addDays(monthStart, i);
            days.push(this.createDayObj(date, true));
        }
        
        // Next month days (to fill 42 cells for 6 weeks)
        const totalCells = 42; // 6 weeks * 7 days
        const daysToAdd = totalCells - days.length;
        for (let i = 1; i <= daysToAdd; i++) {
            const date = addDays(monthEnd, i);
            days.push(this.createDayObj(date, false));
        }
        
        return days;
    }

    // Event handlers
    handleDayClick(day) {
        const event = new CustomEvent('day-click', {
            detail: {
                date: day.date,
                dateString: day.dateString,
                entries: day.entries,
                formattedDate: getFormattedISO(day.date)
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }
    
    navigatePrevMonth() {
        this._calendarDate = prevMonth(this._calendarDate);
        this.render();
    }
    
    navigateNextMonth() {
        this._calendarDate = nextMonth(this._calendarDate);
        this.render();
    }
    
    // Render method
    render() {
        const days = this.calendarDays;
        const monthName = formatMonth(this._calendarDate);
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        this.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #475569;
                }
            </style>
            
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
                    <div class="flex items-center space-x-4">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">${monthName}</h3>
                        <div class="flex border border-slate-200 rounded-lg overflow-hidden bg-white dark:border-slate-700 dark:bg-slate-700">
                            <button id="prev-month" class="p-2 hover:bg-slate-50 border-r border-slate-200 dark:hover:bg-slate-600 dark:border-slate-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </button>
                            <button id="next-month" class="p-2 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
                    ${daysOfWeek.map(day => `
                        <div class="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">${day}</div>
                    `).join('')}
                </div>
                
                <div class="grid grid-cols-7">
                    ${days.map(day => `
                        <div data-date="${day.dateString}" 
                             class="${day.isCurrentMonth ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-600'} 
                                    h-32 border-b border-r border-slate-100 p-2 cursor-pointer hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-700">
                            <span class="${day.isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold dark:bg-indigo-500' : 'text-xs font-medium dark:text-slate-300'}">
                                ${day.day}
                            </span>
                            <div class="mt-2 flex-1 flex flex-col min-h-0">
                                ${this.renderDayEntries(day)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Attach event listeners
        this.querySelector('#prev-month').addEventListener('click', this.navigatePrevMonth);
        this.querySelector('#next-month').addEventListener('click', this.navigateNextMonth);
        
        // Attach click listeners to each day
        days.forEach(day => {
            const dayElement = this.querySelector(`[data-date="${day.dateString}"]`);
            if (dayElement) {
                dayElement.addEventListener('click', () => this.handleDayClick(day));
            }
        });
    }
    
    renderDayEntries(day) {
        if (day.entries.length === 0) return '';
        
        const isTimeSeries = this._currentSeries && this._currentSeries.type === 'time';
        
        if (day.entries.length === 1) {
            const entry = day.entries[0];
            const displayValue = isTimeSeries ? formatDuration(entry.value) : entry.value;
            return `
                <div class="flex-1 flex items-center justify-center text-indigo-600 font-black text-lg hover:bg-indigo-50/50 rounded-lg transition-colors dark:text-indigo-400 dark:hover:bg-slate-700">
                    ${displayValue}
                </div>
            `;
        }
        
        // Multiple entries
        return `
            <div class="space-y-1 overflow-y-auto max-h-20 custom-scrollbar">
                ${day.entries.map(entry => {
                    const displayValue = isTimeSeries ? formatDuration(entry.value) : entry.value;
                    return `
                        <div class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded border border-indigo-200 font-bold truncate hover:bg-indigo-200 transition-colors dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-800/30">
                            ${displayValue}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// Define the custom element
customElements.define('chronos-calendar', CalendarComponent);

// Export for module usage
export default CalendarComponent;