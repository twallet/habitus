import { useState, useRef, useEffect } from "react";
import { TrackingData, TrackingState, DaysPattern, DaysPatternType } from "../models/Tracking";
import { useTrackings } from "../hooks/useTrackings";
import { useReminders } from "../hooks/useReminders";
import { ReminderStatus } from "../models/Reminder";
import { DeleteTrackingConfirmationModal } from "./DeleteTrackingConfirmationModal";
import "./TrackingsList.css";

interface TrackingsListProps {
    trackings?: TrackingData[];
    onEdit: (tracking: TrackingData) => void;
    onCreate?: () => void;
    onCreateTracking?: (createFn: (question: string, notes: string | undefined, icon: string | undefined, schedules: Array<{ hour: number; minutes: number }>, days: DaysPattern) => Promise<TrackingData>) => void;
    isLoading?: boolean;
    onStateChange?: (trackingId: number, newState: TrackingState) => Promise<TrackingData | void>;
    onStateChangeSuccess?: (message: string) => void;
    onDelete?: (trackingId: number) => Promise<void>;
}

/**
 * Utility class for formatting tracking data for display.
 * Follows OOP principles by organizing related formatting methods.
 * @internal
 */
class TrackingFormatter {
    /**
     * Format time from hour and minutes to HH:MM string.
     * @param hour - Hour (0-23)
     * @param minutes - Minutes (0-59)
     * @returns Formatted time string
     */
    static formatTime(hour: number, minutes: number): string {
        return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    /**
     * Format schedules for display (first time + indicator if more).
     * @param schedules - Array of schedule objects
     * @returns Formatted time string
     */
    static formatTimesDisplay(schedules?: Array<{ hour: number; minutes: number }>): string {
        if (!schedules || schedules.length === 0) {
            return "";
        }
        const sorted = [...schedules].sort((a, b) => {
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minutes - b.minutes;
        });
        const firstTime = TrackingFormatter.formatTime(sorted[0].hour, sorted[0].minutes);
        if (schedules.length === 1) {
            return firstTime;
        }
        return `${firstTime} +${schedules.length - 1}`;
    }

    /**
     * Format all schedules for tooltip display.
     * @param schedules - Array of schedule objects
     * @returns Formatted time string with all times
     */
    static formatAllTimes(schedules?: Array<{ hour: number; minutes: number }>): string {
        if (!schedules || schedules.length === 0) {
            return "No times";
        }
        const sorted = [...schedules].sort((a, b) => {
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minutes - b.minutes;
        });
        return sorted.map((s) => TrackingFormatter.formatTime(s.hour, s.minutes)).join(", ");
    }


    /**
     * Format frequency pattern to readable string.
     * @param days - Days pattern
     * @returns Formatted frequency string
     */
    static formatFrequency(days?: DaysPattern): string {
        if (!days) {
            return "Daily";
        }

        switch (days.pattern_type) {
            case DaysPatternType.INTERVAL:
                if (days.interval_value === 1 && days.interval_unit === "days") {
                    return "Daily";
                }
                return `Every ${days.interval_value} ${days.interval_unit || "days"}`;

            case DaysPatternType.DAY_OF_WEEK:
                if (!days.days || days.days.length === 0) {
                    return "Weekly";
                }
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const sortedDays = [...days.days].sort((a, b) => a - b);
                if (sortedDays.length === 7) {
                    return "Daily";
                }
                return sortedDays.map((d) => dayNames[d]).join(", ");

            case DaysPatternType.DAY_OF_MONTH:
                if (days.type === "last_day") {
                    return "Last day of month";
                }
                if (days.type === "weekday_ordinal") {
                    const ordinalLabels = ["", "First", "Second", "Third", "Fourth", "Fifth"];
                    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const ordinal = days.ordinal || 1;
                    const weekday = days.weekday !== undefined ? weekdayNames[days.weekday] : "Monday";
                    return `${ordinalLabels[ordinal]} ${weekday} of month`;
                }
                if (days.day_numbers && days.day_numbers.length > 0) {
                    if (days.day_numbers.length === 1) {
                        return `Day ${days.day_numbers[0]} of month`;
                    }
                    return `Days ${days.day_numbers.join(", ")} of month`;
                }
                return "Monthly";

            case DaysPatternType.DAY_OF_YEAR:
                const monthNames = ["", "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                if (days.month && days.day) {
                    return `${monthNames[days.month]} ${days.day}`;
                }
                return "Yearly";

            default:
                return "Unknown";
        }
    }

    /**
     * Format full frequency details for tooltip.
     * @param days - Days pattern
     * @returns Detailed frequency string
     */
    static formatFullFrequency(days?: DaysPattern): string {
        if (!days) {
            return "Frequency: Daily (every day)";
        }

        let details = "Frequency: ";

        switch (days.pattern_type) {
            case DaysPatternType.INTERVAL:
                if (days.interval_value === 1 && days.interval_unit === "days") {
                    details += "Daily (every day)";
                } else {
                    details += `Every ${days.interval_value} ${days.interval_unit || "days"}`;
                }
                break;

            case DaysPatternType.DAY_OF_WEEK:
                if (!days.days || days.days.length === 0) {
                    details += "Weekly (no specific days)";
                } else {
                    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const sortedDays = [...days.days].sort((a, b) => a - b);
                    const dayLabels = sortedDays.map((d) => dayNames[d]);
                    if (sortedDays.length === 7) {
                        details += "Daily (all days of the week)";
                    } else {
                        details += `Weekly (${dayLabels.join(", ")})`;
                    }
                }
                break;

            case DaysPatternType.DAY_OF_MONTH:
                if (days.type === "last_day") {
                    details += "Monthly (last day of month)";
                } else if (days.type === "weekday_ordinal") {
                    const ordinalLabels = ["", "First", "Second", "Third", "Fourth", "Fifth"];
                    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const ordinal = days.ordinal || 1;
                    const weekday = days.weekday !== undefined ? weekdayNames[days.weekday] : "Monday";
                    details += `Monthly (${ordinalLabels[ordinal]} ${weekday} of month)`;
                } else if (days.day_numbers && days.day_numbers.length > 0) {
                    details += `Monthly (day${days.day_numbers.length > 1 ? "s" : ""} ${days.day_numbers.join(", ")})`;
                } else {
                    details += "Monthly";
                }
                break;

            case DaysPatternType.DAY_OF_YEAR:
                const monthNames = ["", "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                if (days.month && days.day) {
                    details += `Yearly (${monthNames[days.month]} ${days.day})`;
                } else {
                    details += "Yearly";
                }
                break;

            default:
                details += "Unknown";
        }

        return details;
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
     * Format next reminder time for table display.
     * @param nextReminderTime - ISO datetime string or null
     * @returns Formatted reminder time string for display
     */
    static formatNextReminderTimeDisplay(nextReminderTime: string | null): string {
        if (!nextReminderTime) {
            return "—";
        }
        const date = new Date(nextReminderTime);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `${dateStr} ${timeStr}`;
    }
}

/**
 * Filter state interface for tracking filters.
 * @internal
 */
interface FilterState {
    tracking: string;
    times: string;
    frequency: string;
    status: string[]; // Multiple choice for status
}

/**
 * Utility class for filtering tracking data.
 * Follows OOP principles by organizing related filtering methods.
 * @internal
 */
class TrackingFilter {
    /**
     * Filter tracking by question text (case-insensitive contains).
     * @param tracking - Tracking data to filter
     * @param filterValue - Filter text value
     * @returns True if tracking matches filter
     */
    static filterByTracking(tracking: TrackingData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        return tracking.question.toLowerCase().includes(filterValue.toLowerCase());
    }


    /**
     * Filter tracking by times display.
     * @param tracking - Tracking data to filter
     * @param filterValue - Filter text value
     * @returns True if tracking matches filter
     */
    static filterByTimes(tracking: TrackingData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        const timesDisplay = TrackingFormatter.formatTimesDisplay(tracking.schedules);
        return timesDisplay.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter tracking by frequency display.
     * @param tracking - Tracking data to filter
     * @param filterValue - Filter text value
     * @returns True if tracking matches filter
     */
    static filterByFrequency(tracking: TrackingData, filterValue: string): boolean {
        if (!filterValue.trim()) {
            return true;
        }
        const frequencyDisplay = TrackingFormatter.formatFrequency(tracking.days);
        return frequencyDisplay.toLowerCase().includes(filterValue.toLowerCase());
    }

    /**
     * Filter tracking by status.
     * @param tracking - Tracking data to filter
     * @param filterValues - Array of selected status values
     * @returns True if tracking matches filter
     */
    static filterByStatus(tracking: TrackingData, filterValues: string[]): boolean {
        if (!filterValues || filterValues.length === 0) {
            return true;
        }
        const currentState = tracking.state || TrackingState.RUNNING;
        return filterValues.includes(currentState);
    }

    /**
     * Apply all active filters to trackings array.
     * @param trackings - Array of tracking data to filter
     * @param filters - Filter state object
     * @returns Filtered array of trackings
     */
    static applyFilters(trackings: TrackingData[], filters: FilterState): TrackingData[] {
        return trackings.filter((tracking) => {
            return (
                TrackingFilter.filterByTracking(tracking, filters.tracking) &&
                TrackingFilter.filterByTimes(tracking, filters.times) &&
                TrackingFilter.filterByFrequency(tracking, filters.frequency) &&
                TrackingFilter.filterByStatus(tracking, filters.status)
            );
        });
    }
}

/**
 * Utility class for sorting tracking data.
 * Follows OOP principles by organizing related sorting methods.
 * @internal
 */
class TrackingSorter {
    /**
     * Compare two trackings by question text.
     * @param a - First tracking
     * @param b - Second tracking
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareTracking(a: TrackingData, b: TrackingData): number {
        return a.question.localeCompare(b.question);
    }


    /**
     * Compare two trackings by first schedule time.
     * @param a - First tracking
     * @param b - Second tracking
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareTimes(a: TrackingData, b: TrackingData): number {
        const getFirstTime = (tracking: TrackingData): number => {
            if (!tracking.schedules || tracking.schedules.length === 0) {
                return 9999; // No times sort to end
            }
            const sorted = [...tracking.schedules].sort((s1, s2) => {
                if (s1.hour !== s2.hour) return s1.hour - s2.hour;
                return s1.minutes - s2.minutes;
            });
            return sorted[0].hour * 60 + sorted[0].minutes;
        };
        return getFirstTime(a) - getFirstTime(b);
    }

    /**
     * Compare two trackings by frequency display string.
     * @param a - First tracking
     * @param b - Second tracking
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareFrequency(a: TrackingData, b: TrackingData): number {
        const freqA = TrackingFormatter.formatFrequency(a.days);
        const freqB = TrackingFormatter.formatFrequency(b.days);
        return freqA.localeCompare(freqB);
    }

    /**
     * Compare two trackings by status.
     * @param a - First tracking
     * @param b - Second tracking
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareStatus(a: TrackingData, b: TrackingData): number {
        const stateA = a.state || TrackingState.RUNNING;
        const stateB = b.state || TrackingState.RUNNING;
        return stateA.localeCompare(stateB);
    }

    /**
     * Compare two trackings by next reminder time.
     * @param a - First tracking
     * @param b - Second tracking
     * @param getNextReminderTime - Function to get next reminder time for a tracking
     * @returns Comparison result (-1, 0, or 1)
     */
    static compareNextReminder(
        a: TrackingData,
        b: TrackingData,
        getNextReminderTime: (trackingId: number) => string | null
    ): number {
        const timeA = getNextReminderTime(a.id);
        const timeB = getNextReminderTime(b.id);

        // Null values sort to end
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;

        // Compare dates
        const dateA = new Date(timeA).getTime();
        const dateB = new Date(timeB).getTime();
        return dateA - dateB;
    }

    /**
     * Sort trackings array by column and direction.
     * @param trackings - Array of tracking data to sort
     * @param column - Column name to sort by (or null for no sorting)
     * @param direction - Sort direction ('asc', 'desc', or null)
     * @param getNextReminderTime - Optional function to get next reminder time (required for 'next-reminder' column)
     * @returns Sorted array of trackings
     */
    static sortTrackings(
        trackings: TrackingData[],
        column: string | null,
        direction: 'asc' | 'desc' | null,
        getNextReminderTime?: (trackingId: number) => string | null
    ): TrackingData[] {
        if (!column || !direction) {
            return [...trackings];
        }

        const sorted = [...trackings];
        let compareFn: (a: TrackingData, b: TrackingData) => number;

        switch (column) {
            case 'tracking':
                compareFn = TrackingSorter.compareTracking;
                break;
            case 'times':
                compareFn = TrackingSorter.compareTimes;
                break;
            case 'frequency':
                compareFn = TrackingSorter.compareFrequency;
                break;
            case 'next-reminder':
                if (!getNextReminderTime) {
                    return sorted;
                }
                compareFn = (a, b) => TrackingSorter.compareNextReminder(a, b, getNextReminderTime);
                break;
            case 'status':
                compareFn = TrackingSorter.compareStatus;
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
 * Utility class for managing tracking state transitions.
 * Follows OOP principles by organizing related state transition methods.
 * @internal
 */
class StateTransitionHelper {
    /**
     * Get icon for a state transition.
     * @param targetState - The target state for the transition
     * @returns Icon emoji string
     */
    static getTransitionIcon(targetState: TrackingState): string {
        switch (targetState) {
            case TrackingState.PAUSED:
                return "⏸️";
            case TrackingState.RUNNING:
                return "▶️";
            case TrackingState.ARCHIVED:
                return "📦";
            default:
                return "";
        }
    }

    /**
     * Get human-readable label for a state.
     * @param state - The tracking state
     * @returns State label string
     */
    static getStateLabel(state: TrackingState): string {
        return state;
    }

    /**
     * Get action verb for a state transition (e.g., "Pause" instead of "Paused").
     * @param targetState - The target state for the transition
     * @returns Action verb string
     */
    static getActionVerb(targetState: TrackingState): string {
        switch (targetState) {
            case TrackingState.PAUSED:
                return "Pause";
            case TrackingState.RUNNING:
                return "Resume";
            case TrackingState.ARCHIVED:
                return "Archive";
            default:
                return targetState;
        }
    }

    /**
     * Get success message for a state transition.
     * @param newState - The new state
     * @returns Success message string
     */
    static getStateChangeMessage(newState: TrackingState): string {
        switch (newState) {
            case TrackingState.PAUSED:
                return 'Tracking paused successfully';
            case TrackingState.RUNNING:
                return 'Tracking resumed successfully';
            case TrackingState.ARCHIVED:
                return 'Tracking archived successfully';
            default:
                return 'Tracking state updated successfully';
        }
    }

    /**
     * Get color class for a state badge.
     * @param state - The tracking state
     * @returns CSS class name for the state color
     */
    static getStateColorClass(state: TrackingState): string {
        switch (state) {
            case TrackingState.RUNNING:
                return 'state-badge-running';
            case TrackingState.PAUSED:
                return 'state-badge-paused';
            case TrackingState.ARCHIVED:
                return 'state-badge-archived';
            default:
                return 'state-badge-default';
        }
    }
}

/**
 * Component for displaying a list of trackings.
 * Shows tracking table with icon, question, type, times, frequency, notes, and edit action.
 * @param props - Component props
 * @param props.trackings - Array of tracking data
 * @param props.onEdit - Callback when edit button is clicked
 * @param props.onCreate - Optional callback when create button is clicked
 * @param props.isLoading - Whether data is loading
 * @public
 */
export function TrackingsList({
    trackings: propTrackings,
    onEdit,
    onCreate,
    onCreateTracking,
    isLoading: propIsLoading,
    onStateChange,
    onStateChangeSuccess,
    onDelete,
}: TrackingsListProps) {
    const { trackings: hookTrackings, isLoading: hookIsLoading, updateTrackingState: hookUpdateTrackingState, deleteTracking: hookDeleteTracking, createTracking: hookCreateTracking } = useTrackings();
    const { reminders, refreshReminders } = useReminders();
    const [trackingToDelete, setTrackingToDelete] = useState<TrackingData | null>(null);
    const actionRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // Filter and sort state
    const [filterState, setFilterState] = useState<FilterState>({
        tracking: '',
        times: '',
        frequency: '',
        status: [],
    });
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [showFilters, setShowFilters] = useState<boolean>(false);

    // Expose createTracking function to parent via callback
    useEffect(() => {
        if (onCreateTracking) {
            onCreateTracking(hookCreateTracking);
        }
    }, [hookCreateTracking, onCreateTracking]);

    // Use props if provided, otherwise use hook data
    const trackings = propTrackings ?? hookTrackings;
    const isLoading = propIsLoading ?? hookIsLoading;

    // Filter out orphaned reminders (reminders with tracking_id that doesn't exist in trackings)
    // This should never happen - every reminder must have a valid tracking
    const validReminders = reminders.filter((reminder) => {
        const trackingExists = trackings.some((t) => t.id === reminder.tracking_id);
        if (!trackingExists) {
            if (import.meta.env.DEV) {
                console.error(
                    `Reminder ${reminder.id} references tracking ${reminder.tracking_id} which does not exist. This should never happen.`
                );
            }
            return false;
        }
        return true;
    });

    /**
     * Get the next reminder time for a tracking.
     * @param trackingId - Tracking ID
     * @returns Next reminder scheduled time (ISO string) or null if not found
     * @internal
     */
    const getNextReminderTime = (trackingId: number): string | null => {
        const now = new Date();
        const upcomingReminders = validReminders
            .filter((reminder) =>
                reminder.tracking_id === trackingId &&
                (reminder.status === ReminderStatus.PENDING || reminder.status === ReminderStatus.UPCOMING) &&
                new Date(reminder.scheduled_time) > now
            )
            .sort((a, b) =>
                new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
            );

        return upcomingReminders.length > 0 ? upcomingReminders[0].scheduled_time : null;
    };

    // Refresh reminders when trackings change (e.g., after creating or editing a tracking)
    // Use a ref to track previous tracking data to detect changes
    const previousTrackingsRef = useRef<Map<number, { schedules?: Array<{ hour: number; minutes: number }>; days?: DaysPattern; state?: TrackingState; updated_at?: string }>>(new Map());

    useEffect(() => {
        const currentTrackingsMap = new Map(
            trackings.map(t => [t.id, {
                schedules: t.schedules,
                days: t.days,
                state: t.state || TrackingState.RUNNING,
                updated_at: t.updated_at,
            }])
        );
        const previousTrackings = previousTrackingsRef.current;

        // Check if there are new trackings or if existing trackings were updated
        const hasNewTrackings = trackings.some(t => !previousTrackings.has(t.id));

        // Check if any existing tracking was updated (schedules, days pattern, or state changed)
        const hasUpdatedTrackings = trackings.some(t => {
            const prev = previousTrackings.get(t.id);
            if (!prev) return false;

            // Check if schedules changed
            const schedulesChanged = JSON.stringify(t.schedules || []) !== JSON.stringify(prev.schedules || []);

            // Check if days pattern changed
            const daysChanged = JSON.stringify(t.days || {}) !== JSON.stringify(prev.days || {});

            // Check if state changed
            const currentState = t.state || TrackingState.RUNNING;
            const stateChanged = currentState !== prev.state;

            // Check if updated_at timestamp changed (indicates tracking was edited)
            const wasEdited = t.updated_at !== prev.updated_at;

            return schedulesChanged || daysChanged || stateChanged || wasEdited;
        });

        if (hasNewTrackings || hasUpdatedTrackings) {
            // Refresh reminders to get updated reminders after creating or editing a tracking
            refreshReminders();
        }

        // Update the ref with current tracking data
        previousTrackingsRef.current = currentTrackingsMap;
    }, [trackings, refreshReminders]);

    // All trackings are visible (no filtering needed)
    const visibleTrackings = trackings;

    // Apply filters and sorting
    const filteredTrackings = TrackingFilter.applyFilters(visibleTrackings, filterState);
    const filteredAndSortedTrackings = TrackingSorter.sortTrackings(filteredTrackings, sortColumn, sortDirection, getNextReminderTime);

    /**
     * Handle filter change.
     * @param column - Column name
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
     * @param column - Column name ('status')
     * @param value - Value to toggle
     * @internal
     */
    const handleCheckboxChange = (column: 'status', value: string) => {
        setFilterState((prev) => {
            const currentValues = prev[column] as string[];
            const newValues = currentValues.includes(value)
                ? currentValues.filter((v) => v !== value)
                : [...currentValues, value];
            return {
                ...prev,
                [column]: newValues,
            };
        });
    };

    /**
     * Reset all filters to default values.
     * @internal
     */
    const handleResetFilters = () => {
        setFilterState({
            tracking: '',
            times: '',
            frequency: '',
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
     * Handle confirmed deletion.
     * Actually deletes the tracking from the database.
     * @internal
     */
    const handleConfirmDelete = async () => {
        if (!trackingToDelete) {
            return;
        }

        const trackingId = trackingToDelete.id;
        try {
            // Use callback if provided (from parent), otherwise use hook's function
            if (onDelete) {
                await onDelete(trackingId);
            } else {
                await hookDeleteTracking(trackingId);
            }
            // Show success message
            // Success message is handled by the deleteTracking function
        } catch (error) {
            // Error handling is done in the hook or parent
            throw error;
        }
    };

    /**
     * Handle action button click.
     * @param trackingId - The tracking ID
     * @param newState - The new state to transition to
     * @internal
     */
    const handleActionClick = (trackingId: number, newState: TrackingState) => {
        // All state changes proceed immediately
        handleStateChangeImmediate(trackingId, newState);
    };

    /**
     * Handle immediate state change (non-deletion).
     * @param trackingId - The tracking ID
     * @param newState - The new state to transition to
     * @internal
     */
    const handleStateChangeImmediate = async (trackingId: number, newState: TrackingState) => {
        try {
            // Use callback if provided (from parent), otherwise use hook's function
            if (onStateChange) {
                await onStateChange(trackingId, newState);
            } else {
                await hookUpdateTrackingState(trackingId, newState);
            }
            // Show success message
            if (onStateChangeSuccess) {
                onStateChangeSuccess(StateTransitionHelper.getStateChangeMessage(newState));
            }
            // State update will automatically refresh the list
        } catch (error) {
            console.error("Error updating tracking state:", error);
            // Error handling is done in the hook or parent
        }
    };

    if (isLoading) {
        return (
            <div className="trackings-list">
                <div className="loading">Loading trackings...</div>
            </div>
        );
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

    // Filter panel (shown even when no trackings)
    const filterPanel = showFilters ? (
        <div className="filter-panel">
            <div className="filter-panel-content">
                <div className="filter-row">
                    <label htmlFor="filter-tracking" className="filter-label">
                        Tracking:
                    </label>
                    <input
                        type="text"
                        id="filter-tracking"
                        className="filter-input"
                        placeholder="Filter by question..."
                        value={filterState.tracking}
                        onChange={(e) => handleFilterChange('tracking', e.target.value)}
                        aria-label="Filter by tracking"
                    />
                </div>
                <div className="filter-row">
                    <div className="filter-row">
                        <label htmlFor="filter-times" className="filter-label">
                            Times:
                        </label>
                        <input
                            type="text"
                            id="filter-times"
                            className="filter-input"
                            placeholder="Filter by times..."
                            value={filterState.times}
                            onChange={(e) => handleFilterChange('times', e.target.value)}
                            aria-label="Filter by times"
                        />
                    </div>
                    <div className="filter-row">
                        <label htmlFor="filter-frequency" className="filter-label">
                            Frequency:
                        </label>
                        <input
                            type="text"
                            id="filter-frequency"
                            className="filter-input"
                            placeholder="Filter by frequency..."
                            value={filterState.frequency}
                            onChange={(e) => handleFilterChange('frequency', e.target.value)}
                            aria-label="Filter by frequency"
                        />
                    </div>
                    <div className="filter-row">
                        <div className="filter-label">Status:</div>
                        <div className="filter-checkbox-group">
                            <label className="filter-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={filterState.status.includes(TrackingState.RUNNING)}
                                    onChange={() => handleCheckboxChange('status', TrackingState.RUNNING)}
                                    aria-label="Filter by status: Running"
                                />
                                <span>Running</span>
                            </label>
                            <label className="filter-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={filterState.status.includes(TrackingState.PAUSED)}
                                    onChange={() => handleCheckboxChange('status', TrackingState.PAUSED)}
                                    aria-label="Filter by status: Paused"
                                />
                                <span>Paused</span>
                            </label>
                            <label className="filter-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={filterState.status.includes(TrackingState.ARCHIVED)}
                                    onChange={() => handleCheckboxChange('status', TrackingState.ARCHIVED)}
                                    aria-label="Filter by status: Archived"
                                />
                                <span>Archived</span>
                            </label>
                        </div>
                    </div>
                    <div className="filter-actions">
                        <button
                            type="button"
                            className="filter-reset-button"
                            onClick={handleResetFilters}
                            aria-label="Reset all filters"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    if (visibleTrackings.length === 0) {
        return (
            <div className="trackings-list">
                <div className="trackings-list-content">
                    <div className="empty-state">
                        <p>
                            No trackings.{" "}
                            {onCreate ? (
                                <>
                                    <button
                                        type="button"
                                        className="link-button"
                                        onClick={onCreate}
                                        aria-label="Create a new tracking"
                                    >
                                        Create a new tracking
                                    </button>{" "}
                                    to get started!
                                </>
                            ) : (
                                "Create a new tracking to get started!"
                            )}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (filteredAndSortedTrackings.length === 0) {
        return (
            <div className="trackings-list">
                <div className="trackings-list-content">
                    <div className="filter-toggle-container">
                        {filterToggleButton}
                    </div>
                    {filterPanel}
                    <div className="empty-state">
                        <p>No trackings match the current filters.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="trackings-list">
            <div className="trackings-list-content">
                {filterPanel}
                <table className="trackings-table">
                    <thead>
                        <tr>
                            <th className="col-tracking">
                                <div className="header-with-filter">
                                    {filterToggleButton}
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
                                </div>
                            </th>
                            <th className="col-notes">
                                Notes
                            </th>
                            <th className="col-times">
                                <button
                                    type="button"
                                    className="sortable-header"
                                    onClick={() => handleSortClick('times')}
                                    aria-label="Sort by times"
                                >
                                    Times
                                    {sortColumn === 'times' && (
                                        <span className="sort-indicator">
                                            {sortDirection === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </button>
                            </th>
                            <th className="col-frequency">
                                <button
                                    type="button"
                                    className="sortable-header"
                                    onClick={() => handleSortClick('frequency')}
                                    aria-label="Sort by frequency"
                                >
                                    Frequency
                                    {sortColumn === 'frequency' && (
                                        <span className="sort-indicator">
                                            {sortDirection === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </button>
                            </th>
                            <th className="col-next-reminder">
                                <button
                                    type="button"
                                    className="sortable-header"
                                    onClick={() => handleSortClick('next-reminder')}
                                    aria-label="Sort by next reminder"
                                >
                                    Next reminder
                                    {sortColumn === 'next-reminder' && (
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
                            <th className="col-actions">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedTrackings.map((tracking) => {
                            const currentState = tracking.state || TrackingState.RUNNING;
                            const stateLabel = StateTransitionHelper.getStateLabel(currentState);
                            const stateColorClass = StateTransitionHelper.getStateColorClass(currentState);

                            // Determine which actions to show based on current state
                            const getActionsForState = (state: TrackingState) => {
                                switch (state) {
                                    case TrackingState.RUNNING:
                                        return [
                                            {
                                                state: TrackingState.PAUSED,
                                                icon: "⏸️",
                                                label: "Pause",
                                                tooltip: "Pause: Stops generating new reminders. Existing reminders remain active."
                                            },
                                            {
                                                state: TrackingState.ARCHIVED,
                                                icon: "📦",
                                                label: "Archive",
                                                tooltip: "Archive: Moves tracking to archived state and stops all reminder generation. All pending and upcoming reminders will be deleted."
                                            },
                                        ];
                                    case TrackingState.PAUSED:
                                        return [
                                            {
                                                state: TrackingState.RUNNING,
                                                icon: "▶️",
                                                label: "Resume",
                                                tooltip: "Resume: Restarts reminder generation according to the tracking schedule."
                                            },
                                            {
                                                state: TrackingState.ARCHIVED,
                                                icon: "📦",
                                                label: "Archive",
                                                tooltip: "Archive: Moves tracking to archived state and stops all reminder generation. All pending and upcoming reminders will be deleted."
                                            },
                                        ];
                                    case TrackingState.ARCHIVED:
                                        return [
                                            {
                                                state: TrackingState.RUNNING,
                                                icon: "▶️",
                                                label: "Resume",
                                                tooltip: "Resume: Restarts reminder generation according to the tracking schedule."
                                            },
                                        ];
                                    default:
                                        return [];
                                }
                            };

                            const availableActions = getActionsForState(currentState);

                            return (
                                <tr key={tracking.id} className="tracking-row">
                                    <td className="cell-tracking">
                                        {tracking.icon && (
                                            <span className="tracking-icon">
                                                {tracking.icon}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            className="tracking-name-link"
                                            onClick={() => onEdit(tracking)}
                                            aria-label={`Edit tracking: ${tracking.question}`}
                                            title={`${tracking.question}. Click to edit`}
                                        >
                                            {TrackingFormatter.truncateText(tracking.question, 50)}
                                        </button>
                                    </td>
                                    <td className="cell-notes">
                                        {tracking.notes && tracking.notes.trim() ? (
                                            <span
                                                className="notes-icon"
                                                title={tracking.notes}
                                                aria-label={`Notes: ${tracking.notes}`}
                                            >
                                                📝
                                            </span>
                                        ) : (
                                            <span className="notes-empty">—</span>
                                        )}
                                    </td>
                                    <td
                                        className="cell-times"
                                        title={!tracking.schedules || tracking.schedules.length === 0 || tracking.schedules.length > 1 ? TrackingFormatter.formatAllTimes(tracking.schedules) : undefined}
                                    >
                                        {TrackingFormatter.formatTimesDisplay(tracking.schedules)}
                                    </td>
                                    <td
                                        className="cell-frequency"
                                        title={getNextReminderTime(tracking.id) ? undefined : "No upcoming reminder"}
                                    >
                                        {TrackingFormatter.formatFrequency(tracking.days)}
                                    </td>
                                    <td className="cell-next-reminder">
                                        {TrackingFormatter.formatNextReminderTimeDisplay(getNextReminderTime(tracking.id))}
                                    </td>
                                    <td className="cell-status">
                                        <span className={`status-badge ${stateColorClass}`}>
                                            {stateLabel}
                                        </span>
                                    </td>
                                    <td className="cell-actions">
                                        <div
                                            className="actions-container"
                                            ref={(el) => {
                                                actionRefs.current[tracking.id] = el;
                                            }}
                                        >
                                            <div className="actions-buttons">
                                                {availableActions.map((action) => (
                                                    <button
                                                        key={action.state}
                                                        type="button"
                                                        className="action-button"
                                                        onClick={() => handleActionClick(tracking.id, action.state)}
                                                        title={action.tooltip}
                                                        aria-label={action.label}
                                                    >
                                                        {action.icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Mobile Card Layout */}
                <div className="trackings-cards">
                    {filteredAndSortedTrackings.map((tracking) => {
                        const currentState = tracking.state || TrackingState.RUNNING;
                        const stateLabel = StateTransitionHelper.getStateLabel(currentState);
                        const stateColorClass = StateTransitionHelper.getStateColorClass(currentState);
                        const nextReminderTime = getNextReminderTime(tracking.id);

                        return (
                            <div key={tracking.id} className="tracking-card">
                                <div className="tracking-card-header">
                                    {tracking.icon && (
                                        <div className="tracking-card-icon">{tracking.icon}</div>
                                    )}
                                    <div className="tracking-card-title">
                                        <h3 className="tracking-card-question">{tracking.question}</h3>
                                        <div className="tracking-card-times">
                                            {TrackingFormatter.formatTimesDisplay(tracking.schedules)}
                                        </div>
                                    </div>
                                </div>

                                <div className="tracking-card-body">
                                    <div className="tracking-card-row">
                                        <span className="tracking-card-label">Frequency</span>
                                        <span className="tracking-card-value">
                                            {TrackingFormatter.formatFrequency(tracking.days)}
                                        </span>
                                    </div>
                                    {nextReminderTime && (
                                        <div className="tracking-card-row">
                                            <span className="tracking-card-label">Next Reminder</span>
                                            <span className="tracking-card-value">
                                                {TrackingFormatter.formatNextReminderTimeDisplay(nextReminderTime)}
                                            </span>
                                        </div>
                                    )}
                                    {tracking.notes && tracking.notes.trim() && (
                                        <div className="tracking-card-row">
                                            <span className="tracking-card-label">Notes</span>
                                            <span className="tracking-card-value">📝</span>
                                        </div>
                                    )}
                                </div>

                                <div className="tracking-card-footer">
                                    <div className="tracking-card-status">
                                        <span className={`status-badge ${stateColorClass}`}>
                                            {stateLabel}
                                        </span>
                                    </div>
                                    <div className="tracking-card-actions">
                                        <button
                                            type="button"
                                            className="action-button"
                                            onClick={() => onEdit(tracking)}
                                            aria-label="Edit tracking"
                                            title="Edit tracking"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {trackingToDelete && (
                <DeleteTrackingConfirmationModal
                    tracking={trackingToDelete}
                    onClose={() => setTrackingToDelete(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
}

// Default export for compatibility
export default TrackingsList;

