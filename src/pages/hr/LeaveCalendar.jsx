import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Plus,
    MoreHorizontal, Clock, CheckCircle2, XCircle, MapPin, Tag, Trash2, X
} from 'lucide-react';

const LeaveCalendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);

    // Helper to get current user ID for storage key
    const getUserId = () => {
        try {
            // Try common auth session
            const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
            if (authSession) {
                const parsed = JSON.parse(authSession);
                return parsed.employee_id || parsed.id || parsed.email || "guest";
            }
            // Fallback for different roles if needed
            const empSession = localStorage.getItem("hrmss.employee.signin");
            if (empSession) {
                const parsed = JSON.parse(empSession);
                return parsed.employee_id || parsed.id || "guest";
            }
        } catch (e) {
            console.error("Error getting user ID", e);
        }
        return "guest";
    };

    const userId = getUserId();
    const STORAGE_KEY = `HRMSS_CALENDAR_EVENTS_${userId}`;

    // State for events
    // In a real app, this would come from a backend/database
    const [events, setEvents] = useState(() => {
        const officialHolidays = [
            { id: 'h1', date: new Date(2026, 0, 1), type: 'Holiday', category: 'Holiday', title: 'English New Year', color: 'holidayRed' },
            { id: 'h2', date: new Date(2026, 0, 15), type: 'Holiday', category: 'Holiday', title: 'Pongal', color: 'holidayRed' },
            { id: 'h3', date: new Date(2026, 0, 16), type: 'Holiday', category: 'Holiday', title: 'Thiruvalluvar Day', color: 'holidayRed' },
            { id: 'h4', date: new Date(2026, 0, 26), type: 'Holiday', category: 'Holiday', title: 'Republic Day', color: 'holidayRed' },
            { id: 'h5', date: new Date(2026, 3, 3), type: 'Holiday', category: 'Holiday', title: 'Good Friday', color: 'holidayRed' },
            { id: 'h6', date: new Date(2026, 3, 14), type: 'Holiday', category: 'Holiday', title: 'Tamil New Year', color: 'holidayRed' },
            { id: 'h7', date: new Date(2026, 4, 1), type: 'Holiday', category: 'Holiday', title: 'May Day', color: 'holidayRed' },
            { id: 'h8', date: new Date(2026, 8, 14), type: 'Holiday', category: 'Holiday', title: 'Vinayakar Chathurthi', color: 'holidayRed' },
            { id: 'h9', date: new Date(2026, 9, 2), type: 'Holiday', category: 'Holiday', title: 'Gandhi Jayanthi', color: 'holidayRed' },
            { id: 'h10', date: new Date(2026, 9, 19), type: 'Holiday', category: 'Holiday', title: 'Ayutha Pooja', color: 'holidayRed' },
            { id: 'h11', date: new Date(2026, 9, 20), type: 'Holiday', category: 'Holiday', title: 'Vijaya Dasami', color: 'holidayRed' },
            { id: 'h12', date: new Date(2026, 11, 25), type: 'Holiday', category: 'Holiday', title: 'Christmas', color: 'holidayRed' },
        ];

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved).map(e => ({
                    ...e,
                    date: new Date(e.date)
                }));
                // Filter out old holidays if any, or just merge user notes with official holidays
                // For simplicity, we'll keep user notes and ensure holidays are present
                const userNotes = parsed.filter(e => e.type !== 'Holiday');
                return [...officialHolidays, ...userNotes];
            } catch (e) {
                console.error("Failed to parse events", e);
            }
        }
        return officialHolidays;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }, [events, STORAGE_KEY]);

    const [newEvent, setNewEvent] = useState({
        title: '',
        category: 'Meeting',
        customCategory: '',
        time: '',
        description: '',
        color: 'blue'
    });

    const availableColors = [
        { name: 'blue', class: 'bg-blue-500' },
        { name: 'emerald', class: 'bg-emerald-500' },
        { name: 'rose', class: 'bg-rose-500' },
        { name: 'amber', class: 'bg-amber-500' },
        { name: 'indigo', class: 'bg-indigo-500' },
        { name: 'purple', class: 'bg-purple-500' },
        { name: 'slate', class: 'bg-slate-500' },
        { name: 'orange', class: 'bg-orange-500' },
    ];

    const categories = [
        { name: 'Meeting', color: 'blue' },
        { name: 'Travel', color: 'orange' },
        { name: 'Personal', color: 'rose' },
        { name: 'Reminder', color: 'slate' },
        { name: 'Work', color: 'purple' },
        { name: 'Holiday', color: 'indigo' },
        { name: 'Vacation', color: 'emerald' },
        { name: 'Other', color: 'slate' },
    ];

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDateClick = (day) => {
        setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
        setShowAddModal(false); // Close add mode if open to switch view
    };

    const handleAddEvent = (e) => {
        e.preventDefault();
        if (!newEvent.title) return;

        const finalCategory = newEvent.category === 'Other' ? (newEvent.customCategory || 'Other') : newEvent.category;

        const event = {
            id: Date.now(),
            date: selectedDate,
            type: 'Note',
            category: finalCategory,
            title: newEvent.title,
            time: newEvent.time,
            description: newEvent.description,
            color: newEvent.color
        };

        setEvents([...events, event]);
        setNewEvent({ title: '', category: 'Meeting', customCategory: '', time: '', description: '', color: 'blue' });
        setShowAddModal(false);
    };

    const handleDeleteEvent = (id) => {
        setEvents(events.filter(e => e.id !== id));
    };

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    // Filter events for the calendar view (current month)
    const getEventsForDay = (day) => {
        return events.filter(e =>
            e.date.getDate() === day &&
            e.date.getMonth() === currentDate.getMonth() &&
            e.date.getFullYear() === currentDate.getFullYear()
        );
    };

    // Get events for the selected date (side panel)
    const selectedDateEvents = events.filter(e =>
        e.date.getDate() === selectedDate.getDate() &&
        e.date.getMonth() === selectedDate.getMonth() &&
        e.date.getFullYear() === selectedDate.getFullYear()
    );

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();
    };

    const isSelected = (day) => {
        return day === selectedDate.getDate() &&
            currentDate.getMonth() === selectedDate.getMonth() &&
            currentDate.getFullYear() === selectedDate.getFullYear();
    };

    // Helper for dynamic Tailwind classes based on color name
    const getColorClasses = (color, variant = 'bg') => {
        const map = {
            blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', hover: 'hover:bg-blue-100' },
            emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', hover: 'hover:bg-emerald-100' },
            rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', hover: 'hover:bg-rose-100' },
            amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', hover: 'hover:bg-amber-100' },
            indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', hover: 'hover:bg-indigo-100' },
            purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', hover: 'hover:bg-purple-100' },
            slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500', hover: 'hover:bg-slate-100' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', hover: 'hover:bg-orange-100' },
            holidayRed: { bg: 'bg-[#FEF2F2]', text: 'text-[#B91C1C]', border: 'border-[#FECACA]', dot: 'bg-[#DC2626]', hover: 'hover:bg-[#FEE2E2]' },
        };
        return map[color] || map.slate;
    };

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6 animate-fadeIn">
            {/* LEFT: Calendar Grid (2/3) */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-y-auto">
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <CalendarIcon size={20} className="text-purple-600" />
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h2>
                        <p className="text-xs text-slate-500">Select a date to view or add notes</p>
                    </div>
                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <button onClick={prevMonth} className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-all"><ChevronLeft size={18} /></button>
                        <button onClick={nextMonth} className="p-1 hover:bg-white rounded shadow-sm text-slate-600 transition-all"><ChevronRight size={18} /></button>
                    </div>
                </div>

                {/* Grid Header */}
                <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {blanks.map((_, i) => (
                        <div key={`blank-${i}`} className="bg-slate-50/20 border-b border-r border-slate-100 p-2" />
                    ))}

                    {daysInMonth.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const today = isToday(day);
                        const selected = isSelected(day);

                        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                        return (
                            <div
                                key={day}
                                onClick={() => handleDateClick(day)}
                                className={`
                  relative border-b border-r border-slate-100 p-2 cursor-pointer transition-all duration-200
                  hover:bg-purple-50/30 flex flex-col gap-1 min-h-[60px] md:min-h-0
                  ${selected ? 'bg-indigo-50/20 ring-inset ring-2 ring-indigo-500/20 z-10' : ''}
                  ${today ? 'bg-slate-50' : ''}
                  ${isWeekend ? 'bg-rose-50/30' : ''}
                `}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`
                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                    ${today ? 'bg-slate-900 text-white shadow-md' : selected ? 'bg-indigo-600 text-white shadow-md' : isWeekend ? 'text-rose-600 font-bold bg-white/60' : 'text-slate-600'}
                  `}>
                                        {day}
                                    </span>

                                    {/* Dots indicator for multiple events */}
                                    {dayEvents.length > 0 && (
                                        <div className="flex -space-x-1">
                                            {dayEvents.slice(0, 3).map((ev, i) => (
                                                <div key={i} className={`w-2 h-2 rounded-full border border-white ${getColorClasses(ev.color).dot}`} />
                                            ))}
                                            {dayEvents.length > 3 && <div className="w-2 h-2 rounded-full bg-slate-300 border border-white" />}
                                        </div>
                                    )}
                                </div>

                                {/* Tiny Label for first event */}
                                {dayEvents.length > 0 && (
                                    <div className={`mt-auto text-[10px] truncate px-1.5 py-0.5 rounded-sm ${getColorClasses(dayEvents[0].color).bg} ${getColorClasses(dayEvents[0].color).text}`}>
                                        {dayEvents[0].title}
                                        {dayEvents.length > 1 && <span className="ml-1 opacity-70">+{dayEvents.length - 1}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT: Side Panel (1/3) */}
            <div className="w-80 flex flex-col gap-4 animate-slideInRight">
                {/* Selected Date Header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
                            </h3>
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
                            title="Add Note"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 my-4" />

                    {/* Events List */}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {selectedDateEvents.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CalendarIcon size={20} />
                                </div>
                                <p className="text-sm">No events for this day</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="mt-2 text-indigo-600 text-xs font-semibold hover:underline"
                                >
                                    Add a note
                                </button>
                            </div>
                        ) : (
                            selectedDateEvents.map(event => {
                                const colors = getColorClasses(event.color);
                                return (
                                    <div key={event.id} className={`group p-3 rounded-xl border ${colors.bg} ${colors.border} relative hover:shadow-md transition-all`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/50 ${colors.text} uppercase tracking-wider`}>
                                                {event.category}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteEvent(event.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 rounded text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <h4 className={`font-semibold text-sm ${colors.text} leading-tight`}>{event.title}</h4>
                                        {event.time && (
                                            <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                                                <Clock size={10} /> {event.time}
                                            </div>
                                        )}
                                        {event.description && (
                                            <p className={`mt-2 text-xs opacity-90 leading-relaxed border-t border-black/5 pt-2 ${colors.text}`}>
                                                {event.description}
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Add Note Form (Conditional or Always visible depending on UX, here using conditional overlay style inside panel or replacing list) */}
                {showAddModal && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xl animate-scaleIn relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                        >
                            <X size={16} />
                        </button>
                        <h3 className="font-bold text-slate-800 mb-4">Add Note</h3>
                        <form onSubmit={handleAddEvent} className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Title</label>
                                <input
                                    type="text"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="e.g., Team Meeting"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
                                    <select
                                        value={newEvent.category}
                                        onChange={e => setNewEvent({ ...newEvent, category: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        {categories.map(c => (
                                            <option key={c.name} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                    {newEvent.category === 'Other' && (
                                        <input
                                            type="text"
                                            value={newEvent.customCategory}
                                            onChange={e => setNewEvent({ ...newEvent, customCategory: e.target.value })}
                                            className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            placeholder="Enter custom category"
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Time (Opt)</label>
                                    <input
                                        type="time"
                                        value={newEvent.time}
                                        onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Color Tag</label>
                                <div className="flex items-center gap-2">
                                    {availableColors.map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => setNewEvent({ ...newEvent, color: c.name })}
                                            className={`w-6 h-6 rounded-full ${c.class} transition-all ${newEvent.color === c.name ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Description</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-20 resize-none"
                                    placeholder="Add details..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-all shadow-md"
                            >
                                Save Note
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaveCalendar;
