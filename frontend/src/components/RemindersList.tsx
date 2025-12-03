import { useState, useRef, useEffect } from "react";
import { ReminderData, ReminderStatus } from "../models/Reminder";
import { TrackingData } from "../models/Tracking";
import { useReminders } from "../hooks/useReminders";
import { useTrackings } from "../hooks/useTrackings";
import { ReminderAnswerModal } from "./ReminderAnswerModal";
import "./RemindersList.css";

/**
 * Snooze options in minutes.
 * @private
 */
const SNOOZE_OPTIONS = [
    { label: "15 min", minutes: 15 },
    { label: "30 min", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "3 hours", minutes: 180 },
    { label: "24 hours", minutes: 1440 },
    { label: "7 days", minutes: 10080 },
];

/**
 * Filter state interface for reminder filters.
 * @internal
 */
interface FilterState {
    time: string;
    tracking: string;
    answer: string;
    notes: string;
    status: string[]; // Multiple choice for status
}

/**
 * Utility class for filtering reminder data.
 * Follows OOP principles by organizing related filtering methods.
 * @internal
 */
class ReminderFilter {
    /**
     * Filter reminder by time display (case-insensitive contains).
     * @param reminder - Reminder data to filter
     * @param filterValue - Filter text value
     * @returns True if reminder matches filter
     */
    static filterByTime(reminder: ReminderData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        const timeDisplay = ReminderFormatter.formatDateTime(reminder.scheduled_time);
        return timeDisplay.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter reminder by tracking question text (case-insensitive contains).
     * @param reminder - Reminder data to filter
     * @param filterValue - Filter text value
     * @param getTracking - Function to get tracking data
     * @returns True if reminder matches filter
     */
    static filterByTracking(reminder: ReminderData, filterValue: string, getTracking: (id: number) => TrackingData | undefined): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        const tracking = getTracking(reminder.tracking_id);
        if (!tracking) {
            return false;
        }
        return tracking.question.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter reminder by answer text (case-insensitive contains).
     * @param reminder - Reminder data to filter
     * @param filterValue - Filter text value
     * @returns True if reminder matches filter
     */
    static filterByAnswer(reminder: ReminderData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        if (!reminder.answer) {
            return false;
        }
        return reminder.answer.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter reminder by notes text (case-insensitive contains).
     * @param reminder - Reminder data to filter
     * @param filterValue - Filter text value
     * @returns True if reminder matches filter
     */
    static filterByNotes(reminder: ReminderData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        if (!reminder.notes) {
            return false;
        }
        return reminder.notes.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter reminder by status.
     * @param reminder - Reminder data to filter
     * @param filterValues - Array of selected status values
     * @returns True if reminder matches filter
     */
    static filterByStatus(reminder: ReminderData, filterValues: string[]): boolean {
        if (!filterValues || filterValues.length === 0) {
            return true;
        }
        return filterValues.includes(reminder.status);
    }

    /**
     * Apply all active filters to reminders array.
     * @param reminders - Array of reminder data to filter
     * @param filters - Filter state object
     * @param getTracking - Function to get tracking data
     * @returns Filtered array of reminders
     */
    static applyFilters(reminders: ReminderData[], filters: FilterState, getTracking: (id: number) => TrackingData | undefined): ReminderData[] {
        return reminders.filter((reminder) => {
            return (
                ReminderFilter.filterByTime(reminder, filters.time) &&
                ReminderFilter.filterByTracking(reminder, filters.tracking, getTracking) &&
                ReminderFilter.filterByAnswer(reminder, filters.answer) &&
                ReminderFilter.filterByNotes(reminder, filters.notes) &&
                ReminderFilter.filterByStatus(reminder, filters.status)
            );
        });
    }
}

/**
 * Utility class for sorting reminder data.
 * Follows OOP principles by organizing related sorting methods.
 * @internal
 */
class ReminderSorter {
    /**
     * Compare two reminders by scheduled time.
     * @param a - First reminder
     * @param b - Second reminder
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareTime(a: ReminderData, b: ReminderData): number {
        const timeA = new Date(a.scheduled_time).getTime();
        const timeB = new Date(b.scheduled_time).getTime();
        return timeA - timeB;
    }

    /**
     * Compare two reminders by tracking question text.
     * @param a - First reminder
     * @param b - Second reminder
     * @param getTracking - Function to get tracking data
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareTracking(a: ReminderData, b: ReminderData, getTracking: (id: number) => TrackingData | undefined): number {
        const trackingA = getTracking(a.tracking_id);
        const trackingB = getTracking(b.tracking_id);
        const questionA = trackingA?.question || "";
        const questionB = trackingB?.question || "";
        return questionA.localeCompare(questionB);
    }

    /**
     * Compare two reminders by answer text.
     * @param a - First reminder
     * @param b - Second reminder
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareAnswer(a: ReminderData, b: ReminderData): number {
        const answerA = a.answer || "";
        const answerB = b.answer || "";
        return answerA.localeCompare(answerB);
    }

    /**
     * Compare two reminders by notes text.
     * @param a - First reminder
     * @param b - Second reminder
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareNotes(a: ReminderData, b: ReminderData): number {
        const notesA = a.notes || "";
        const notesB = b.notes || "";
        return notesA.localeCompare(notesB);
    }

    /**
     * Compare two reminders by status.
     * @param a - First reminder
     * @param b - Second reminder
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareStatus(a: ReminderData, b: ReminderData): number {
        return a.status.localeCompare(b.status);
    }

    /**
     * Sort reminders array by column and direction.
     * @param reminders - Array of reminder data to sort
     * @param column - Column name to sort by (or null for no sorting)
     * @param direction - Sort direction ('asc', 'desc', or null)
     * @param getTracking - Function to get tracking data
     * @returns Sorted array of reminders
     */
    static sortReminders(
        reminders: ReminderData[],
        column: string | null,
        direction: 'asc' | 'desc' | null,
        getTracking: (id: number) => TrackingData | undefined
    ): ReminderData[] {
        if (!column || !direction) {
            return [...reminders];
        }

        const sorted = [...reminders];
        let compareFn: (a: ReminderData, b: ReminderData) => number;

        switch (column) {
            case 'time':
                compareFn = ReminderSorter.compareTime;
                break;
            case 'tracking':
                compareFn = (a, b) => ReminderSorter.compareTracking(a, b, getTracking);
                break;
            case 'answer':
                compareFn = ReminderSorter.compareAnswer;
                break;
            case 'notes':
                compareFn = ReminderSorter.compareNotes;
                break;
            case 'status':
                compareFn = ReminderSorter.compareStatus;
                break;
            default:
                return sorted;
        }

        sorted.sort((a, b) => {
            const result = compareFn(a, b);
            return direction === 'asc' ? result : -result;
        });

        return sorted;
    }
}

/**
 * Utility class for formatting reminder data for display.
 * Follows OOP principles by organizing related formatting methods.
 * @public
 */
export class ReminderFormatter {
    /**
     * Format date and time for display.
     * @param dateTime - ISO datetime string
     * @returns Formatted date and time string
     */
    static formatDateTime(dateTime: string): string {
        const date = new Date(dateTime);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `${dateStr} ${timeStr}`;
    }

    /**
     * Truncate text to specified length.
     * @param text - Text to truncate
     * @param maxLength - Maximum length
     * @returns Truncated text
     */
    static truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    /**
     * Get status color class.
     * @param status - Reminder status
     * @returns CSS class name
     */
    static getStatusColorClass(status: ReminderStatus): string {
        switch (status) {
            case ReminderStatus.PENDING:
                return "status-pending";
            case ReminderStatus.ANSWERED:
                return "status-answered";
            case ReminderStatus.SNOOZED:
                return "status-snoozed";
            default:
                return "";
        }
    }
}

interface RemindersListProps {
    onCreate?: () => void;
}

/**
 * RemindersList component for displaying reminders in a table.
 * @param props - Component props
 * @param props.onCreate - Optional callback when create tracking link is clicked
 * @public
 */
export function RemindersList({ onCreate }: RemindersListProps = {}) {
    const { reminders, isLoading, updateReminder, snoozeReminder, deleteReminder, refreshReminders } = useReminders();
    const { trackings } = useTrackings();
    const [editingReminder, setEditingReminder] = useState<ReminderData | null>(null);
    const [reminderToDelete, setReminderToDelete] = useState<ReminderData | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
    const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const dropdownMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // Filter and sort state
    const [filterState, setFilterState] = useState<FilterState>({
        time: "",
        tracking: "",
        answer: "",
        notes: "",
        status: [],
    });
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [showFilters, setShowFilters] = useState<boolean>(false);

    /**
     * Get tracking for a reminder.
     * @param trackingId - Tracking ID
     * @returns Tracking data or undefined
     * @internal
     */
    const getTracking = (trackingId: number): TrackingData | undefined => {
        return trackings.find((t) => t.id === trackingId);
    };

    // Apply filters and sorting
    const filteredReminders = ReminderFilter.applyFilters(reminders, filterState, getTracking);
    const filteredAndSortedReminders = ReminderSorter.sortReminders(filteredReminders, sortColumn, sortDirection, getTracking);

    /**
     * Handle filter change.
     * @param column - Filter column name
     * @param value - Filter value (string for text inputs, string[] for checkboxes)
     * @internal
     */
    const handleFilterChange = (column: keyof FilterState, value: string | string[]) => {
        setFilterState((prev) => ({
            ...prev,
            [column]: value,
        }));
    };

    /**
     * Handle checkbox filter change (toggle selection).
     * @param column - Filter column name
     * @param value - Value to toggle
     * @internal
     */
    const handleCheckboxFilterChange = (column: keyof FilterState, value: string) => {
        setFilterState((prev) => {
            const currentValues = (prev[column] as string[]) || [];
            return {
                ...prev,
                [column]: currentValues.includes(value)
                    ? currentValues.filter((v) => v !== value)
                    : [...currentValues, value],
            };
        });
    };

    /**
     * Reset all filters to default values.
     * @internal
     */
    const handleResetFilters = () => {
        setFilterState({
            time: "",
            tracking: "",
            answer: "",
            notes: "",
            status: [],
        });
    };

    /**
     * Toggle filter panel visibility.
     * @internal
     */
    const toggleFilters = () => {
        setShowFilters((prev) => !prev);
    };

    /**
     * Handle sort column click.
     * Cycles through: none → asc → desc → none
     * @param column - Column name to sort by
     * @internal
     */
    const handleSortClick = (column: string) => {
        if (sortColumn === column) {
            // Cycle: asc → desc → none
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortColumn(null);
                setSortDirection(null);
            }
        } else {
            // New column, start with asc
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    /**
     * Toggle dropdown for a reminder.
     * @param reminderId - Reminder ID
     * @internal
     */
    const toggleDropdown = (reminderId: number) => {
        if (openDropdownId === reminderId) {
            setOpenDropdownId(null);
            setDropdownPosition(null);
        } else {
            setOpenDropdownId(reminderId);
            setOpenSnoozeId(null);
            // Calculate position after state update
            setTimeout(() => {
                const container = dropdownRefs.current[reminderId];
                if (container) {
                    const rect = container.getBoundingClientRect();
                    setDropdownPosition({
                        top: rect.bottom + 4,
                        right: window.innerWidth - rect.right,
                    });
                }
            }, 0);
        }
    };

    /**
     * Toggle snooze menu for a reminder.
     * @param reminderId - Reminder ID
     * @internal
     */
    const toggleSnoozeMenu = (reminderId: number) => {
        if (openSnoozeId === reminderId) {
            setOpenSnoozeId(null);
        } else {
            setOpenSnoozeId(reminderId);
            setOpenDropdownId(null);
            setDropdownPosition(null);
        }
    };

    /**
     * Handle snooze.
     * @param reminderId - Reminder ID
     * @param minutes - Minutes to snooze
     * @internal
     */
    const handleSnooze = async (reminderId: number, minutes: number) => {
        try {
            await snoozeReminder(reminderId, minutes);
            setOpenSnoozeId(null);
            setOpenDropdownId(null);
            setDropdownPosition(null);
            // Refresh reminders to get updated data
            await refreshReminders();
        } catch (error) {
            console.error("Error snoozing reminder:", error);
        }
    };

    /**
     * Handle answer/edit.
     * @param reminder - Reminder data
     * @internal
     */
    const handleAnswer = (reminder: ReminderData) => {
        setEditingReminder(reminder);
        setOpenDropdownId(null);
        setDropdownPosition(null);
    };

    /**
     * Handle delete.
     * @param reminder - Reminder data
     * @internal
     */
    const handleDelete = (reminder: ReminderData) => {
        setReminderToDelete(reminder);
        setOpenDropdownId(null);
        setDropdownPosition(null);
    };

    /**
     * Confirm delete.
     * @internal
     */
    const handleConfirmDelete = async () => {
        if (!reminderToDelete) {
            return;
        }
        try {
            await deleteReminder(reminderToDelete.id);
            setReminderToDelete(null);
        } catch (error) {
            console.error("Error deleting reminder:", error);
        }
    };

    /**
     * Handle modal save.
     * @param reminderId - Reminder ID
     * @param answer - Answer text
     * @param notes - Notes text
     * @internal
     */
    const handleModalSave = async (
        reminderId: number,
        answer: string,
        notes: string
    ) => {
        try {
            await updateReminder(reminderId, answer, notes, ReminderStatus.ANSWERED);
            setEditingReminder(null);
            // Refresh reminders to get updated data
            await refreshReminders();
        } catch (error) {
            console.error("Error updating reminder:", error);
            throw error;
        }
    };

    /**
     * Close dropdowns when clicking outside.
     * @internal
     */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check status dropdowns
            Object.values(dropdownRefs.current).forEach((ref) => {
                if (ref && ref.contains(target)) {
                    return;
                }
            });
            Object.values(dropdownMenuRefs.current).forEach((ref) => {
                if (ref && ref.contains(target)) {
                    return;
                }
            });

            // Check snooze menus
            Object.values(snoozeMenuRefs.current).forEach((ref) => {
                if (ref && ref.contains(target)) {
                    return;
                }
            });

            setOpenDropdownId(null);
            setOpenSnoozeId(null);
            setDropdownPosition(null);
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (isLoading) {
        return <div className="reminders-loading">Loading reminders...</div>;
    }

    // Filter toggle button (reusable)
    const filterToggleButton = (
        <button
            type="button"
            className="filter-toggle-button"
            onClick={toggleFilters}
            aria-label={showFilters ? "Hide filters" : "Show filters"}
            aria-expanded={showFilters}
            title={showFilters ? "Hide filters" : "Show filters"}
        >
            <span className="filter-toggle-icon">🔍</span>
        </button>
    );

    // Filter panel
    const filterPanel = showFilters ? (
        <div className="filter-panel">
            <div className="filter-panel-content">
                <div className="filter-row">
                    <label htmlFor="filter-time" className="filter-label">
                        Time:
                    </label>
                    <input
                        type="text"
                        id="filter-time"
                        className="filter-input"
                        placeholder="Filter by time..."
                        value={filterState.time}
                        onChange={(e) => handleFilterChange('time', e.target.value)}
                        aria-label="Filter by time"
                    />
                </div>
                <div className="filter-row">
                    <label htmlFor="filter-tracking" className="filter-label">
                        Tracking:
                    </label>
                    <input
                        type="text"
                        id="filter-tracking"
                        className="filter-input"
                        placeholder="Filter by tracking..."
                        value={filterState.tracking}
                        onChange={(e) => handleFilterChange('tracking', e.target.value)}
                        aria-label="Filter by tracking"
                    />
                </div>
                <div className="filter-row">
                    <label htmlFor="filter-answer" className="filter-label">
                        Answer:
                    </label>
                    <input
                        type="text"
                        id="filter-answer"
                        className="filter-input"
                        placeholder="Filter by answer..."
                        value={filterState.answer}
                        onChange={(e) => handleFilterChange('answer', e.target.value)}
                        aria-label="Filter by answer"
                    />
                </div>
                <div className="filter-row">
                    <label htmlFor="filter-notes" className="filter-label">
                        Notes:
                    </label>
                    <input
                        type="text"
                        id="filter-notes"
                        className="filter-input"
                        placeholder="Filter by notes..."
                        value={filterState.notes}
                        onChange={(e) => handleFilterChange('notes', e.target.value)}
                        aria-label="Filter by notes"
                    />
                </div>
                <div className="filter-row">
                    <div className="filter-label">Status:</div>
                    <div className="filter-checkbox-group">
                        <label className="filter-checkbox-label">
                            <input
                                type="checkbox"
                                checked={filterState.status.includes(ReminderStatus.PENDING)}
                                onChange={() => handleCheckboxFilterChange('status', ReminderStatus.PENDING)}
                                aria-label="Filter by status: Pending"
                            />
                            <span>Pending</span>
                        </label>
                        <label className="filter-checkbox-label">
                            <input
                                type="checkbox"
                                checked={filterState.status.includes(ReminderStatus.ANSWERED)}
                                onChange={() => handleCheckboxFilterChange('status', ReminderStatus.ANSWERED)}
                                aria-label="Filter by status: Answered"
                            />
                            <span>Answered</span>
                        </label>
                        <label className="filter-checkbox-label">
                            <input
                                type="checkbox"
                                checked={filterState.status.includes(ReminderStatus.SNOOZED)}
                                onChange={() => handleCheckboxFilterChange('status', ReminderStatus.SNOOZED)}
                                aria-label="Filter by status: Snoozed"
                            />
                            <span>Snoozed</span>
                        </label>
                    </div>
                </div>
                <div className="filter-row">
                    <button
                        type="button"
                        className="btn-secondary filter-reset-button"
                        onClick={handleResetFilters}
                        aria-label="Reset all filters"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (reminders.length === 0) {
        return (
            <div className="reminders-list">
                <div className="reminders-empty">
                    <p>
                        No reminders yet.{" "}
                        {onCreate ? (
                            <>
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={onCreate}
                                    aria-label="Create your first tracking"
                                >
                                    Create your first tracking
                                </button>{" "}
                                to get started!
                            </>
                        ) : (
                            "Create your first tracking to get started!"
                        )}
                    </p>
                </div>
            </div>
        );
    }

    if (filteredAndSortedReminders.length === 0) {
        return (
            <div className="reminders-list">
                <div className="reminders-list-content">
                    <div className="filter-toggle-container">
                        {filterToggleButton}
                    </div>
                    {filterPanel}
                    <div className="empty-state">
                        <p>No reminders match the current filters.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="reminders-list">
            <div className="reminders-list-content">
                {filterPanel}
                <div className="reminders-table-container">
                    <table className="reminders-table">
                        <thead>
                            <tr>
                                <th className="col-time">
                                    <div className="header-with-filter">
                                        {filterToggleButton}
                                        <button
                                            type="button"
                                            className="sortable-header"
                                            onClick={() => handleSortClick('time')}
                                            aria-label="Sort by time"
                                        >
                                            Time
                                            {sortColumn === 'time' && (
                                                <span className="sort-indicator">
                                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </th>
                                <th className="col-tracking">
                                    <button
                                        type="button"
                                        className="sortable-header"
                                        onClick={() => handleSortClick('tracking')}
                                        aria-label="Sort by tracking"
                                    >
                                        Tracking
                                        {sortColumn === 'tracking' && (
                                            <span className="sort-indicator">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </button>
                                </th>
                                <th className="col-answer">
                                    <button
                                        type="button"
                                        className="sortable-header"
                                        onClick={() => handleSortClick('answer')}
                                        aria-label="Sort by answer"
                                    >
                                        Answer
                                        {sortColumn === 'answer' && (
                                            <span className="sort-indicator">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </button>
                                </th>
                                <th className="col-notes">
                                    <button
                                        type="button"
                                        className="sortable-header"
                                        onClick={() => handleSortClick('notes')}
                                        aria-label="Sort by notes"
                                    >
                                        Notes
                                        {sortColumn === 'notes' && (
                                            <span className="sort-indicator">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </button>
                                </th>
                                <th className="col-status">
                                    <button
                                        type="button"
                                        className="sortable-header"
                                        onClick={() => handleSortClick('status')}
                                        aria-label="Sort by status"
                                    >
                                        Status
                                        {sortColumn === 'status' && (
                                            <span className="sort-indicator">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedReminders.map((reminder) => {
                                const tracking = getTracking(reminder.tracking_id);
                                const isDropdownOpen = openDropdownId === reminder.id;
                                const isSnoozeOpen = openSnoozeId === reminder.id;
                                const statusColorClass = ReminderFormatter.getStatusColorClass(reminder.status);

                                return (
                                    <tr key={reminder.id} className="reminder-row">
                                        <td className="cell-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</td>
                                        <td className="cell-tracking">
                                            {tracking ? (
                                                <span
                                                    title={tracking.question}
                                                    className="tracking-text"
                                                >
                                                    {tracking.icon && (
                                                        <span className="tracking-icon">{tracking.icon}</span>
                                                    )}
                                                    {ReminderFormatter.truncateText(tracking.question, 50)}
                                                </span>
                                            ) : (
                                                "Unknown tracking"
                                            )}
                                        </td>
                                        <td className="cell-answer">
                                            {reminder.answer ? (
                                                <span
                                                    title={reminder.answer}
                                                    className="answer-text"
                                                >
                                                    {ReminderFormatter.truncateText(reminder.answer, 50)}
                                                </span>
                                            ) : (
                                                <span className="answer-empty">—</span>
                                            )}
                                        </td>
                                        <td className="cell-notes">
                                            {reminder.notes ? (
                                                <span
                                                    title={reminder.notes}
                                                    className="notes-indicator"
                                                >
                                                    📝
                                                </span>
                                            ) : (
                                                <span className="notes-empty">—</span>
                                            )}
                                        </td>
                                        <td className="cell-status">
                                            <div
                                                className="status-dropdown-container"
                                                ref={(el) => {
                                                    dropdownRefs.current[reminder.id] = el;
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className={`status-badge ${statusColorClass} ${isDropdownOpen ? "open" : ""}`}
                                                    onClick={() => toggleDropdown(reminder.id)}
                                                    aria-label={`Current status: ${reminder.status}. Click to change status`}
                                                    aria-expanded={isDropdownOpen}
                                                >
                                                    <span className="status-badge-text">{reminder.status}</span>
                                                    <span className="status-badge-arrow">▼</span>
                                                </button>
                                                {isDropdownOpen && dropdownPosition && (
                                                    <div
                                                        className="status-dropdown-menu"
                                                        ref={(el) => {
                                                            dropdownMenuRefs.current[reminder.id] = el;
                                                        }}
                                                        style={{
                                                            top: `${dropdownPosition.top}px`,
                                                            right: `${dropdownPosition.right}px`,
                                                        }}
                                                    >
                                                        {reminder.status === ReminderStatus.PENDING && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => toggleSnoozeMenu(reminder.id)}
                                                                >
                                                                    <span className="status-dropdown-icon">⏰</span>
                                                                    <span className="status-dropdown-label">Snooze</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleAnswer(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">✏️</span>
                                                                    <span className="status-dropdown-label">Answer</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleDelete(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">🗑️</span>
                                                                    <span className="status-dropdown-label">Delete</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        {reminder.status === ReminderStatus.ANSWERED && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleAnswer(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">✏️</span>
                                                                    <span className="status-dropdown-label">Edit</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleDelete(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">🗑️</span>
                                                                    <span className="status-dropdown-label">Delete</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        {reminder.status === ReminderStatus.SNOOZED && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleAnswer(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">✏️</span>
                                                                    <span className="status-dropdown-label">Answer</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="status-dropdown-item"
                                                                    onClick={() => handleDelete(reminder)}
                                                                >
                                                                    <span className="status-dropdown-icon">🗑️</span>
                                                                    <span className="status-dropdown-label">Delete</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {isSnoozeOpen && (
                                                <div
                                                    className="snooze-menu"
                                                    ref={(el) => {
                                                        snoozeMenuRefs.current[reminder.id] = el;
                                                    }}
                                                >
                                                    {SNOOZE_OPTIONS.map((option) => (
                                                        <button
                                                            key={option.minutes}
                                                            type="button"
                                                            className="snooze-menu-item"
                                                            onClick={() => handleSnooze(reminder.id, option.minutes)}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {editingReminder && (
                <ReminderAnswerModal
                    reminder={editingReminder}
                    tracking={getTracking(editingReminder.tracking_id)}
                    onClose={() => setEditingReminder(null)}
                    onSave={handleModalSave}
                />
            )}
            {reminderToDelete && (
                <div className="modal-overlay" onClick={() => setReminderToDelete(null)}>
                    <div className="modal-content delete-confirmation" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Reminder</h3>
                        <p>Are you sure you want to delete this reminder? A new reminder will be created automatically.</p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setReminderToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleConfirmDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

