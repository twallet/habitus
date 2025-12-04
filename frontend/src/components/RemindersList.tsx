import { useState, useRef, useEffect, useCallback } from "react";
import { ReminderData, ReminderStatus } from "../models/Reminder";
import { TrackingData } from "../models/Tracking";
import { useReminders } from "../hooks/useReminders";
import { useTrackings } from "../hooks/useTrackings";
import "./RemindersList.css";

/**
 * Snooze options in minutes.
 * @private
 */
const SNOOZE_OPTIONS = [
    { label: "5 min", minutes: 5 },
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
            case ReminderStatus.UPCOMING:
                return "status-upcoming";
            default:
                return "";
        }
    }

    /**
     * Build tracking tooltip text with icon, question, and notes if available.
     * @param tracking - Tracking data
     * @returns Tooltip text
     */
    static buildTrackingTooltip(tracking: TrackingData): string {
        let tooltip = "";
        if (tracking.icon) {
            tooltip += tracking.icon + " ";
        }
        tooltip += tracking.question;
        if (tracking.notes) {
            tooltip += " - Notes: " + tracking.notes;
        }
        return tooltip;
    }
}

interface RemindersListProps {
    trackings?: TrackingData[];
    isLoadingTrackings?: boolean;
    onCreate?: () => void;
    onMessage?: (text: string, type: 'success' | 'error') => void;
    // Optional props to share reminders state with parent component (for immediate badge updates)
    reminders?: ReminderData[];
    isLoadingReminders?: boolean;
    updateReminder?: (reminderId: number, notes?: string, status?: ReminderStatus) => Promise<ReminderData>;
    checkReminder?: (reminderId: number, checked: boolean) => Promise<ReminderData>;
    snoozeReminder?: (reminderId: number, minutes: number) => Promise<ReminderData>;
    deleteReminder?: (reminderId: number) => Promise<void>;
}

/**
 * RemindersList component for displaying reminders in a table.
 * @param props - Component props
 * @param props.trackings - Optional array of tracking data (if not provided, will use useTrackings hook)
 * @param props.isLoadingTrackings - Optional loading state for trackings
 * @param props.onCreate - Optional callback when create tracking link is clicked
 * @param props.onMessage - Optional callback to display success/error messages
 * @param props.reminders - Optional array of reminder data (if not provided, will use useReminders hook)
 * @param props.isLoadingReminders - Optional loading state for reminders
 * @param props.updateReminder - Optional function to update a reminder (if not provided, will use useReminders hook)
 * @param props.snoozeReminder - Optional function to snooze a reminder (if not provided, will use useReminders hook)
 * @param props.deleteReminder - Optional function to delete a reminder (if not provided, will use useReminders hook)
 * @public
 */
export function RemindersList({
    trackings: propTrackings,
    isLoadingTrackings: propIsLoadingTrackings,
    onCreate: _onCreate,
    onMessage,
    reminders: propReminders,
    isLoadingReminders: propIsLoadingReminders,
    updateReminder: propUpdateReminder,
    checkReminder: propCheckReminder,
    snoozeReminder: propSnoozeReminder,
    deleteReminder: propDeleteReminder
}: RemindersListProps = {}) {
    // Use hook only if props not provided (for backward compatibility)
    const hookReminders = useReminders();
    const {
        reminders: hookRemindersData,
        isLoading: hookIsLoading,
        updateReminder: hookUpdateReminder,
        checkReminder: hookCheckReminder,
        snoozeReminder: hookSnoozeReminder,
        deleteReminder: hookDeleteReminder
    } = hookReminders;

    const { trackings: hookTrackings, isLoading: hookIsLoadingTrackings } = useTrackings();

    // Use props if provided, otherwise use hook data
    const reminders = propReminders ?? hookRemindersData;
    const isLoading = propIsLoadingReminders ?? hookIsLoading;
    const updateReminder = propUpdateReminder ?? hookUpdateReminder;
    const checkReminder = propCheckReminder ?? hookCheckReminder;
    const snoozeReminder = propSnoozeReminder ?? hookSnoozeReminder;
    const deleteReminder = propDeleteReminder ?? hookDeleteReminder;
    const trackings = propTrackings ?? hookTrackings;
    const isLoadingTrackings = propIsLoadingTrackings ?? hookIsLoadingTrackings;
    const [reminderToDelete, setReminderToDelete] = useState<ReminderData | null>(null);
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const [snoozeMenuPosition, setSnoozeMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const actionRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // Filter and sort state
    const [filterState, setFilterState] = useState<FilterState>({
        time: "",
        tracking: "",
        notes: "",
        status: [],
    });
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [showFilters, setShowFilters] = useState<boolean>(false);

    /**
     * Get tracking for a reminder.
     * Uses trackings from useTrackings hook, which updates automatically when trackings change.
     * @param trackingId - Tracking ID
     * @returns Tracking data or undefined
     * @internal
     */
    const getTracking = useCallback((trackingId: number): TrackingData | undefined => {
        return trackings.find((t) => t.id === trackingId);
    }, [trackings]);

    /**
     * Get the next reminder time for a tracking after skipping the current one.
     * @param trackingId - Tracking ID
     * @returns Next reminder scheduled time (ISO string) or null if not found
     * @internal
     */
    const getNextReminderTime = useCallback((trackingId: number): string | null => {
        const now = new Date();
        const upcomingReminders = reminders
            .filter((reminder) =>
                reminder.tracking_id === trackingId &&
                (reminder.status === ReminderStatus.PENDING || reminder.status === ReminderStatus.UPCOMING) &&
                new Date(reminder.scheduled_time) > now
            )
            .sort((a, b) =>
                new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
            );

        return upcomingReminders.length > 0 ? upcomingReminders[0].scheduled_time : null;
    }, [reminders]);

    // Filter reminders for display: only show Pending reminders whose scheduled time has been reached
    // Answered reminders are hidden (they should not appear in the reminders table)
    // Upcoming reminders are hidden (they have future times and should not be shown)
    // For Pending reminders, only show if scheduled time has been reached
    const now = new Date();
    const remindersForDisplay = reminders.filter((reminder) => {
        // Hide Answered reminders - they should not appear in the reminders table
        if (reminder.status === ReminderStatus.ANSWERED) {
            return false;
        }
        // Hide Upcoming reminders - they have future times and should not be shown
        if (reminder.status === ReminderStatus.UPCOMING) {
            return false;
        }
        const scheduledTime = new Date(reminder.scheduled_time);
        // For Pending reminders, only show if scheduled time has been reached
        return reminder.status === ReminderStatus.PENDING && scheduledTime <= now;
    });

    // Apply filters and sorting
    const filteredReminders = ReminderFilter.applyFilters(remindersForDisplay, filterState, getTracking);
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
     * Toggle snooze menu for a reminder.
     * @param reminderId - Reminder ID
     * @internal
     */
    const toggleSnoozeMenu = (reminderId: number) => {
        if (openSnoozeId === reminderId) {
            setOpenSnoozeId(null);
            setSnoozeMenuPosition(null);
        } else {
            setOpenSnoozeId(reminderId);
            // Calculate position after state update
            setTimeout(() => {
                const container = actionRefs.current[reminderId];
                if (container) {
                    const rect = container.getBoundingClientRect();
                    setSnoozeMenuPosition({
                        top: rect.bottom + 4,
                        right: window.innerWidth - rect.right,
                    });
                }
            }, 0);
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
            const updatedReminder = await snoozeReminder(reminderId, minutes);
            setOpenSnoozeId(null);
            setSnoozeMenuPosition(null);
            // Badge updates immediately via optimistic update in useReminders hook
            if (onMessage) {
                const formattedTime = ReminderFormatter.formatDateTime(updatedReminder.scheduled_time);
                onMessage(`Reminder snoozed successfully (Next: ${formattedTime})`, "success");
            }
        } catch (error) {
            console.error("Error snoozing reminder:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error ? error.message : "Error snoozing reminder",
                    "error"
                );
            }
        }
    };

    /**
     * Handle check/uncheck.
     * @param reminder - Reminder data
     * @param checked - Whether to check (true) or uncheck (false)
     * @internal
     */
    const handleCheck = async (reminder: ReminderData, checked: boolean) => {
        try {
            await checkReminder(reminder.id, checked);
            // Badge updates immediately via optimistic update in useReminders hook
            if (onMessage) {
                onMessage(
                    checked
                        ? "Reminder checked successfully"
                        : "Reminder unchecked successfully",
                    "success"
                );
            }
        } catch (error) {
            console.error("Error checking reminder:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error
                        ? error.message
                        : "Error checking reminder",
                    "error"
                );
            }
        }
    };

    /**
     * Handle delete.
     * @param reminder - Reminder data
     * @internal
     */
    const handleDelete = (reminder: ReminderData) => {
        setReminderToDelete(reminder);
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
            const trackingId = reminderToDelete.tracking_id;
            // Get next reminder time before deletion (if there's already an upcoming reminder)
            const nextTime = getNextReminderTime(trackingId);
            await deleteReminder(reminderToDelete.id);
            setReminderToDelete(null);
            if (onMessage) {
                if (nextTime) {
                    const formattedTime = ReminderFormatter.formatDateTime(nextTime);
                    onMessage(`Reminder skipped successfully (Next: ${formattedTime})`, "success");
                } else {
                    // Backend will create a new reminder, but we don't know its time yet
                    onMessage("Reminder skipped successfully", "success");
                }
            }
        } catch (error) {
            console.error("Error deleting reminder:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error ? error.message : "Error skipping reminder",
                    "error"
                );
            }
        }
    };


    /**
     * Close dropdowns when clicking outside.
     * @internal
     */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check action containers
            for (const ref of Object.values(actionRefs.current)) {
                if (ref && ref.contains(target)) {
                    return;
                }
            }

            // Check snooze menus
            for (const ref of Object.values(snoozeMenuRefs.current)) {
                if (ref && ref.contains(target)) {
                    return;
                }
            }

            setOpenSnoozeId(null);
            setSnoozeMenuPosition(null);
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (isLoading || isLoadingTrackings) {
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
                    <label className="filter-label">Status:</label>
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
                                checked={filterState.status.includes(ReminderStatus.UPCOMING)}
                                onChange={() => handleCheckboxFilterChange('status', ReminderStatus.UPCOMING)}
                                aria-label="Filter by status: Upcoming"
                            />
                            <span>Upcoming</span>
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

    // If there are no reminders to display at all (after filtering by scheduled time),
    // show simple message without filter UI
    if (remindersForDisplay.length === 0) {
        return (
            <div className="reminders-list">
                <div className="reminders-empty">
                    <p>No pending reminders.</p>
                </div>
            </div>
        );
    }

    // If there are reminders but they're all filtered out by user filters,
    // show filter UI and appropriate message
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
                                <th className="col-check">
                                    Check
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
                                <th className="col-actions">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedReminders.map((reminder) => {
                                const tracking = getTracking(reminder.tracking_id);
                                const isSnoozeOpen = openSnoozeId === reminder.id;

                                return (
                                    <tr key={reminder.id} className="reminder-row">
                                        <td className="cell-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</td>
                                        <td className="cell-tracking">
                                            {tracking ? (
                                                <span
                                                    title={ReminderFormatter.buildTrackingTooltip(tracking)}
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
                                        <td className="cell-check">
                                            <input
                                                type="checkbox"
                                                checked={reminder.status === ReminderStatus.ANSWERED}
                                                onChange={(e) => handleCheck(reminder, e.target.checked)}
                                                aria-label={reminder.status === ReminderStatus.ANSWERED ? "Uncheck reminder" : "Check reminder"}
                                                title={reminder.status === ReminderStatus.ANSWERED ? "Uncheck reminder" : "Check reminder"}
                                            />
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
                                        <td className="cell-actions">
                                            <div
                                                className="actions-container"
                                                ref={(el) => {
                                                    actionRefs.current[reminder.id] = el;
                                                }}
                                            >
                                                <div className="actions-buttons">
                                                    {reminder.status === ReminderStatus.PENDING && (
                                                        <button
                                                            type="button"
                                                            className="action-button action-snooze"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSnoozeMenu(reminder.id);
                                                            }}
                                                            title="Snooze reminder (click to see options)"
                                                            aria-label="Snooze reminder"
                                                        >
                                                            💤
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="action-button action-skip"
                                                        onClick={() => handleDelete(reminder)}
                                                        title={(() => {
                                                            const nextTime = getNextReminderTime(reminder.tracking_id);
                                                            if (nextTime) {
                                                                const formattedTime = ReminderFormatter.formatDateTime(nextTime);
                                                                return `Skip reminder (Next: ${formattedTime})`;
                                                            }
                                                            return "Skip reminder";
                                                        })()}
                                                        aria-label="Skip reminder"
                                                    >
                                                        ⏭️
                                                    </button>
                                                </div>
                                                {isSnoozeOpen && snoozeMenuPosition && (
                                                    <div
                                                        className="snooze-menu"
                                                        ref={(el) => {
                                                            snoozeMenuRefs.current[reminder.id] = el;
                                                        }}
                                                        style={{
                                                            top: `${snoozeMenuPosition.top}px`,
                                                            right: `${snoozeMenuPosition.right}px`,
                                                        }}
                                                    >
                                                        {SNOOZE_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.minutes}
                                                                type="button"
                                                                className="snooze-menu-item"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSnooze(reminder.id, option.minutes);
                                                                }}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {reminderToDelete && (
                <div className="modal-overlay" onClick={() => setReminderToDelete(null)}>
                    <div className="modal-content delete-confirmation" onClick={(e) => e.stopPropagation()}>
                        <h3>Skip reminder</h3>
                        <p>The current reminder will be deleted and the next one will be created for this tracking.</p>
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
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}