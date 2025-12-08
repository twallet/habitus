import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
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
                ReminderFilter.filterByNotes(reminder, filters.notes)
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
     * Build tracking tooltip text with icon and question.
     * @param tracking - Tracking data
     * @returns Tooltip text
     */
    static buildTrackingTooltip(tracking: TrackingData): string {
        let tooltip = "";
        if (tracking.icon) {
            tooltip += tracking.icon + " ";
        }
        tooltip += tracking.question;
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
    completeReminder?: (reminderId: number) => Promise<ReminderData>;
    dismissReminder?: (reminderId: number) => Promise<ReminderData>;
    snoozeReminder?: (reminderId: number, minutes: number) => Promise<ReminderData>;
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
 * @param props.completeReminder - Optional function to complete a reminder (if not provided, will use useReminders hook)
 * @param props.dismissReminder - Optional function to dismiss a reminder (if not provided, will use useReminders hook)
 * @param props.snoozeReminder - Optional function to snooze a reminder (if not provided, will use useReminders hook)
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
    completeReminder: propCompleteReminder,
    dismissReminder: propDismissReminder,
    snoozeReminder: propSnoozeReminder
}: RemindersListProps = {}) {
    // Use hook only if props not provided
    const hookReminders = useReminders();
    const {
        reminders: hookRemindersData,
        isLoading: hookIsLoading,
        updateReminder: hookUpdateReminder,
        completeReminder: hookCompleteReminder,
        dismissReminder: hookDismissReminder,
        snoozeReminder: hookSnoozeReminder
    } = hookReminders;

    const { trackings: hookTrackings, isLoading: hookIsLoadingTrackings } = useTrackings();

    // Use props if provided, otherwise use hook data
    const reminders = propReminders ?? hookRemindersData;
    const isLoading = propIsLoadingReminders ?? hookIsLoading;
    const updateReminder = propUpdateReminder ?? hookUpdateReminder;
    const completeReminder = propCompleteReminder ?? hookCompleteReminder;
    const dismissReminder = propDismissReminder ?? hookDismissReminder;
    const snoozeReminder = propSnoozeReminder ?? hookSnoozeReminder;
    const trackings = propTrackings ?? hookTrackings;
    const isLoadingTrackings = propIsLoadingTrackings ?? hookIsLoadingTrackings;
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const [snoozeDropdownPosition, setSnoozeDropdownPosition] = useState<Record<number, { top: number; left: number }>>({});
    const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
    const [notesValues, setNotesValues] = useState<Record<number, string>>({});
    const actionRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const notesTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

    // Filter and sort state
    const [filterState, setFilterState] = useState<FilterState>({
        time: "",
        tracking: "",
        notes: "",
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


    // Filter reminders for display: show all Pending reminders
    // Answered reminders are hidden (they should not appear in the reminders table)
    // Upcoming reminders are hidden (they have future times and should not be shown)
    // Show all Pending reminders regardless of scheduled time
    const remindersForDisplay = reminders.filter((reminder) => {
        // Hide Answered reminders - they should not appear in the reminders table
        if (reminder.status === ReminderStatus.ANSWERED) {
            return false;
        }
        // Hide Upcoming reminders - they have future times and should not be shown
        if (reminder.status === ReminderStatus.UPCOMING) {
            return false;
        }
        // Show all Pending reminders
        return reminder.status === ReminderStatus.PENDING;
    });

    // Filter out reminders with missing trackings (data integrity check)
    // This should never happen - every reminder must have a valid tracking
    const remindersWithValidTrackings = remindersForDisplay.filter((reminder) => {
        const tracking = getTracking(reminder.tracking_id);
        if (!tracking && !isLoadingTrackings) {
            // Trackings are loaded but this reminder's tracking is missing - data integrity issue
            if (import.meta.env.DEV) {
                console.error(
                    `Reminder ${reminder.id} references tracking ${reminder.tracking_id} which does not exist. This should never happen.`
                );
            }
            return false;
        }
        return true;
    });

    // Apply filters and sorting
    const filteredReminders = ReminderFilter.applyFilters(remindersWithValidTrackings, filterState, getTracking);
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
     * Reset all filters to default values.
     * @internal
     */
    const handleResetFilters = () => {
        setFilterState({
            time: "",
            tracking: "",
            notes: "",
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
     * Toggle snooze dropdown for a reminder.
     * @param reminderId - Reminder ID
     * @internal
     */
    const toggleSnoozeDropdown = (reminderId: number) => {
        if (openSnoozeId === reminderId) {
            setOpenSnoozeId(null);
            setSnoozeDropdownPosition(prev => {
                const newPos = { ...prev };
                delete newPos[reminderId];
                return newPos;
            });
        } else {
            setOpenSnoozeId(reminderId);
        }
    };

    /**
     * Calculate dropdown position when it opens.
     * @internal
     */
    useLayoutEffect(() => {
        if (openSnoozeId !== null) {
            const button = snoozeButtonRefs.current[openSnoozeId];
            if (button) {
                const rect = button.getBoundingClientRect();
                setSnoozeDropdownPosition(prev => ({
                    ...prev,
                    [openSnoozeId]: {
                        top: rect.bottom + 4,
                        left: rect.left
                    }
                }));
            }
        }
    }, [openSnoozeId]);

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
            setSnoozeDropdownPosition(prev => {
                const newPos = { ...prev };
                delete newPos[reminderId];
                return newPos;
            });
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
     * Handle complete.
     * @param reminder - Reminder data
     * @internal
     */
    const handleComplete = async (reminder: ReminderData) => {
        try {
            await completeReminder(reminder.id);
            // Badge updates immediately via optimistic update in useReminders hook
            if (onMessage) {
                onMessage("Reminder completed successfully", "success");
            }
        } catch (error) {
            console.error("Error completing reminder:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error
                        ? error.message
                        : "Error completing reminder",
                    "error"
                );
            }
        }
    };

    /**
     * Handle dismiss.
     * @param reminder - Reminder data
     * @internal
     */
    const handleDismiss = async (reminder: ReminderData) => {
        try {
            await dismissReminder(reminder.id);
            // Badge updates immediately via optimistic update in useReminders hook
            if (onMessage) {
                onMessage("Reminder dismissed successfully", "success");
            }
        } catch (error) {
            console.error("Error dismissing reminder:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error
                        ? error.message
                        : "Error dismissing reminder",
                    "error"
                );
            }
        }
    };




    /**
     * Handle saving notes.
     * @param reminderId - Reminder ID
     * @internal
     */
    const handleSaveNotes = async (reminderId: number) => {
        const notesToSave = notesValues[reminderId] ?? "";
        try {
            await updateReminder(reminderId, notesToSave);
            setEditingNotesId(null);
            if (onMessage) {
                onMessage("Notes updated successfully", "success");
            }
        } catch (error) {
            console.error("Error updating notes:", error);
            if (onMessage) {
                onMessage(
                    error instanceof Error
                        ? error.message
                        : "Error updating notes",
                    "error"
                );
            }
        }
    };

    /**
     * Handle canceling notes editing.
     * @param reminderId - Reminder ID
     * @internal
     */
    const handleCancelEditingNotes = (reminderId: number) => {
        setEditingNotesId(null);
        // Reset to original notes value
        const reminder = reminders.find(r => r.id === reminderId);
        if (reminder) {
            setNotesValues(prev => ({
                ...prev,
                [reminderId]: reminder.notes || ""
            }));
        }
    };

    /**
     * Handle notes textarea keydown.
     * @param e - Keyboard event
     * @param reminderId - Reminder ID
     * @internal
     */
    const handleNotesKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>,
        reminderId: number
    ) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSaveNotes(reminderId);
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelEditingNotes(reminderId);
        }
    };

    /**
     * Initialize notes values from reminders.
     * @internal
     */
    useEffect(() => {
        const newNotesValues: Record<number, string> = {};
        reminders.forEach(reminder => {
            newNotesValues[reminder.id] = reminder.notes || "";
        });
        setNotesValues(newNotesValues);
    }, [reminders]);

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

            // Check snooze dropdowns
            for (const ref of Object.values(snoozeDropdownRefs.current)) {
                if (ref && ref.contains(target)) {
                    return;
                }
            }

            // Check snooze buttons
            for (const ref of Object.values(snoozeButtonRefs.current)) {
                if (ref && ref.contains(target)) {
                    return;
                }
            }

            setOpenSnoozeId(null);
            setSnoozeDropdownPosition({});
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
                                // This should never happen - we filtered out reminders with missing trackings above
                                if (!tracking) {
                                    if (import.meta.env.DEV) {
                                        console.error(
                                            `Reminder ${reminder.id} has no tracking. This should never happen.`
                                        );
                                    }
                                    return null;
                                }

                                return (
                                    <tr key={reminder.id} className="reminder-row">
                                        <td className="cell-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</td>
                                        <td className="cell-tracking">
                                            <span
                                                title={ReminderFormatter.buildTrackingTooltip(tracking)}
                                                className="tracking-text"
                                            >
                                                {tracking.icon && (
                                                    <span className="tracking-icon">{tracking.icon}</span>
                                                )}
                                                {ReminderFormatter.truncateText(tracking.question, 50)}
                                            </span>
                                        </td>
                                        <td className="cell-notes">
                                            <textarea
                                                ref={(el) => {
                                                    notesTextareaRefs.current[reminder.id] = el;
                                                }}
                                                className="notes-textarea"
                                                value={notesValues[reminder.id] ?? (reminder.notes || "")}
                                                onChange={(e) => {
                                                    setNotesValues(prev => ({
                                                        ...prev,
                                                        [reminder.id]: e.target.value
                                                    }));
                                                    if (editingNotesId !== reminder.id) {
                                                        setEditingNotesId(reminder.id);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (editingNotesId === reminder.id) {
                                                        handleSaveNotes(reminder.id);
                                                    }
                                                }}
                                                onKeyDown={(e) => handleNotesKeyDown(e, reminder.id)}
                                                rows={2}
                                                placeholder="Add notes..."
                                                onClick={(e) => e.stopPropagation()}
                                            />
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
                                                            className="action-button action-complete"
                                                            onClick={() => handleComplete(reminder)}
                                                            title="Complete reminder"
                                                            aria-label="Complete reminder"
                                                        >
                                                            ✓
                                                        </button>
                                                    )}
                                                    {reminder.status === ReminderStatus.PENDING && (
                                                        <button
                                                            type="button"
                                                            className="action-button action-dismiss"
                                                            onClick={() => handleDismiss(reminder)}
                                                            title="Dismiss reminder"
                                                            aria-label="Dismiss reminder"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                    {reminder.status === ReminderStatus.PENDING && (
                                                        <div
                                                            className="snooze-dropdown-container"
                                                            ref={(el) => {
                                                                snoozeDropdownRefs.current[reminder.id] = el;
                                                            }}
                                                        >
                                                            <button
                                                                ref={(el) => {
                                                                    snoozeButtonRefs.current[reminder.id] = el;
                                                                }}
                                                                type="button"
                                                                className="action-button action-snooze snooze-dropdown-button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSnoozeDropdown(reminder.id);
                                                                }}
                                                                aria-label="Snooze reminder"
                                                                aria-expanded={openSnoozeId === reminder.id}
                                                                title="Snooze"
                                                            >
                                                                💤
                                                                {openSnoozeId === reminder.id && <span className="dropdown-arrow">▼</span>}
                                                            </button>
                                                            {openSnoozeId === reminder.id && snoozeDropdownPosition[reminder.id] && (
                                                                <div
                                                                    className="snooze-dropdown"
                                                                    ref={(el) => {
                                                                        snoozeDropdownRefs.current[reminder.id] = el;
                                                                    }}
                                                                    style={{
                                                                        top: `${snoozeDropdownPosition[reminder.id].top}px`,
                                                                        left: `${snoozeDropdownPosition[reminder.id].left}px`,
                                                                    }}
                                                                >
                                                                    {SNOOZE_OPTIONS.map((option) => (
                                                                        <button
                                                                            key={option.minutes}
                                                                            type="button"
                                                                            className="snooze-dropdown-item"
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
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="reminders-cards">
                    {filteredAndSortedReminders.map((reminder) => {
                        const tracking = getTracking(reminder.tracking_id);
                        if (!tracking) return null;

                        return (
                            <div key={reminder.id} className="reminder-card">
                                <div className="reminder-card-header">
                                    {tracking.icon && (
                                        <div className="reminder-card-icon">{tracking.icon}</div>
                                    )}
                                    <div className="reminder-card-title">
                                        <h3 className="reminder-card-question">{tracking.question}</h3>
                                        <div className="reminder-card-time">
                                            {ReminderFormatter.formatDateTime(reminder.scheduled_time)}
                                        </div>
                                    </div>
                                </div>

                                {reminder.notes && (
                                    <div className="reminder-card-body">
                                        <div className="reminder-card-row">
                                            <span className="reminder-card-label">Notes</span>
                                            <span className="reminder-card-value">
                                                {ReminderFormatter.truncateText(reminder.notes, 50)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="reminder-card-footer">
                                    <div className="reminder-card-actions">
                                        <button
                                            type="button"
                                            className="action-button action-complete"
                                            onClick={() => handleComplete(reminder)}
                                            aria-label="Complete reminder"
                                            title="Complete"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            type="button"
                                            className="action-button action-snooze"
                                            onClick={() => toggleSnoozeDropdown(reminder.id)}
                                            aria-label="Snooze reminder"
                                            title="Snooze"
                                        >
                                            💤
                                        </button>
                                        <button
                                            type="button"
                                            className="action-button action-dismiss"
                                            onClick={() => handleDismiss(reminder)}
                                            aria-label="Dismiss reminder"
                                            title="Dismiss"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}