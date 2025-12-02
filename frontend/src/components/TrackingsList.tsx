import { useState, useRef, useEffect } from "react";
import { TrackingData, TrackingType, TrackingState, DaysPattern, DaysPatternType } from "../models/Tracking";
import { useTrackings } from "../hooks/useTrackings";
import { DeleteTrackingConfirmationModal } from "./DeleteTrackingConfirmationModal";
import "./TrackingsList.css";

interface TrackingsListProps {
    trackings?: TrackingData[];
    onEdit: (tracking: TrackingData) => void;
    onCreate?: () => void;
    onCreateTracking?: (createFn: (question: string, type: TrackingType, notes: string | undefined, icon: string | undefined, schedules: Array<{ hour: number; minutes: number }>, days: DaysPattern) => Promise<TrackingData>) => void;
    isLoading?: boolean;
    onStateChange?: (trackingId: number, newState: TrackingState) => Promise<TrackingData | void>;
    onStateChangeSuccess?: (message: string) => void;
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
     * Get type emoji only.
     * @param type - Tracking type
     * @returns Emoji string
     */
    static getTypeEmoji(type: TrackingType): string {
        switch (type) {
            case TrackingType.TRUE_FALSE:
                return "🔘";
            case TrackingType.REGISTER:
                return "🖊️";
            default:
                return "";
        }
    }

    /**
     * Get full type label for tooltip.
     * @param type - Tracking type
     * @returns Full type label
     */
    static getFullTypeLabel(type: TrackingType): string {
        switch (type) {
            case TrackingType.TRUE_FALSE:
                return "Yes/No";
            case TrackingType.REGISTER:
                return "Text";
            default:
                return type;
        }
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
}

/**
 * Utility class for managing tracking state transitions.
 * Follows OOP principles by organizing related state transition methods.
 * @internal
 */
class StateTransitionHelper {
    /**
     * Get valid state transitions for a given current state.
     * All states can be reached from any state (except from DELETED).
     * @param currentState - The current tracking state
     * @returns Array of valid target states
     */
    static getValidTransitions(currentState: TrackingState): TrackingState[] {
        // Cannot transition from DELETED state
        if (currentState === TrackingState.DELETED) {
            return [];
        }
        // All other states can transition to any state (except DELETED requires confirmation)
        return [
            TrackingState.RUNNING,
            TrackingState.PAUSED,
            TrackingState.ARCHIVED,
            TrackingState.DELETED,
        ];
    }

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
            case TrackingState.DELETED:
                return "🗑️";
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
            case TrackingState.DELETED:
                return "Delete";
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
            case TrackingState.DELETED:
                return 'Tracking deleted successfully';
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
            case TrackingState.DELETED:
                return 'state-badge-deleted';
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
}: TrackingsListProps) {
    const { trackings: hookTrackings, isLoading: hookIsLoading, updateTrackingState: hookUpdateTrackingState, deleteTracking: hookDeleteTracking, createTracking: hookCreateTracking } = useTrackings();
    const [trackingToDelete, setTrackingToDelete] = useState<TrackingData | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
    const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const dropdownMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // Expose createTracking function to parent via callback
    useEffect(() => {
        if (onCreateTracking) {
            onCreateTracking(hookCreateTracking);
        }
    }, [hookCreateTracking, onCreateTracking]);

    // Use props if provided, otherwise use hook data
    const trackings = propTrackings ?? hookTrackings;
    const isLoading = propIsLoading ?? hookIsLoading;

    // Filter out Deleted trackings
    const visibleTrackings = trackings.filter(
        (tracking) => tracking.state !== TrackingState.DELETED
    );

    /**
     * Handle click outside dropdown to close it.
     * @internal
     */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openDropdownId !== null) {
                const dropdownElement = dropdownRefs.current[openDropdownId];
                const dropdownMenuElement = dropdownMenuRefs.current[openDropdownId];
                const target = event.target as Node;
                if (
                    dropdownElement &&
                    !dropdownElement.contains(target) &&
                    dropdownMenuElement &&
                    !dropdownMenuElement.contains(target)
                ) {
                    setOpenDropdownId(null);
                    setDropdownPosition(null);
                }
            }
        };

        if (openDropdownId !== null) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [openDropdownId]);

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
            // Always use the actual delete function to remove from database
            await hookDeleteTracking(trackingId);
            // Show success message
            if (onStateChangeSuccess) {
                onStateChangeSuccess(StateTransitionHelper.getStateChangeMessage(TrackingState.DELETED));
            }
        } catch (error) {
            // Error handling is done in the hook
            throw error;
        }
    };

    /**
     * Toggle dropdown for a specific tracking.
     * @param trackingId - The tracking ID
     * @internal
     */
    const toggleDropdown = (trackingId: number) => {
        if (openDropdownId === trackingId) {
            setOpenDropdownId(null);
            setDropdownPosition(null);
        } else {
            setOpenDropdownId(trackingId);
            // Calculate position after state update
            setTimeout(() => {
                const container = dropdownRefs.current[trackingId];
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
     * Handle state transition click.
     * Shows confirmation modal for deletion.
     * @param trackingId - The tracking ID
     * @param newState - The new state to transition to
     * @internal
     */
    const handleStateChange = (trackingId: number, newState: TrackingState) => {
        // Find the tracking to get its current state
        const tracking = trackings.find((t) => t.id === trackingId);
        if (!tracking) {
            console.error("Tracking not found for state change");
            return;
        }

        // Close dropdown
        setOpenDropdownId(null);
        setDropdownPosition(null);

        // Show confirmation modal for deletion
        if (newState === TrackingState.DELETED) {
            setTrackingToDelete(tracking);
            return;
        }

        // For non-deletion state changes, proceed immediately
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

    if (visibleTrackings.length === 0) {
        return (
            <div className="trackings-list">
                <div className="empty-state">
                    <p>
                        No trackings yet.{" "}
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

    return (
        <div className="trackings-list">
            <table className="trackings-table">
                <thead>
                    <tr>
                        <th className="col-tracking">Tracking</th>
                        <th className="col-type">Type</th>
                        <th className="col-times">Times</th>
                        <th className="col-frequency">Frequency</th>
                        <th className="col-status">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleTrackings.map((tracking) => {
                        const currentState = tracking.state || TrackingState.RUNNING;
                        const validTransitions = StateTransitionHelper.getValidTransitions(currentState);
                        const stateLabel = StateTransitionHelper.getStateLabel(currentState);
                        const isDropdownOpen = openDropdownId === tracking.id;
                        const stateColorClass = StateTransitionHelper.getStateColorClass(currentState);

                        return (
                            <tr key={tracking.id} className="tracking-row">
                                <td className="cell-tracking">
                                    <button
                                        type="button"
                                        className="tracking-name-link"
                                        onClick={() => onEdit(tracking)}
                                        aria-label={`Edit tracking: ${tracking.question}`}
                                        title={`${tracking.question}. Click to edit`}
                                    >
                                        {tracking.icon ? (
                                            <>
                                                <span className="tracking-icon">
                                                    {tracking.icon}
                                                </span>
                                                {" "}
                                                {TrackingFormatter.truncateText(tracking.question, 50)}
                                            </>
                                        ) : (
                                            TrackingFormatter.truncateText(tracking.question, 50)
                                        )}
                                    </button>
                                </td>
                                <td className="cell-type" title={TrackingFormatter.getFullTypeLabel(tracking.type)}>
                                    {TrackingFormatter.getTypeEmoji(tracking.type)}
                                </td>
                                <td className="cell-times" title={TrackingFormatter.formatAllTimes(tracking.schedules)}>
                                    {TrackingFormatter.formatTimesDisplay(tracking.schedules)}
                                </td>
                                <td className="cell-frequency" title={TrackingFormatter.formatFullFrequency(tracking.days)}>
                                    {TrackingFormatter.formatFrequency(tracking.days)}
                                </td>
                                <td className="cell-status">
                                    <div
                                        className="status-dropdown-container"
                                        ref={(el) => {
                                            dropdownRefs.current[tracking.id] = el;
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className={`status-badge ${stateColorClass} ${isDropdownOpen ? "open" : ""}`}
                                            onClick={() => toggleDropdown(tracking.id)}
                                            aria-label={`Current status: ${stateLabel}. Click to change status`}
                                            aria-expanded={isDropdownOpen}
                                        >
                                            <span className="status-badge-text">{stateLabel}</span>
                                            <span className="status-badge-arrow">▼</span>
                                        </button>
                                        {isDropdownOpen && dropdownPosition && (
                                            <div
                                                className="status-dropdown-menu"
                                                ref={(el) => {
                                                    dropdownMenuRefs.current[tracking.id] = el;
                                                }}
                                                style={{
                                                    top: `${dropdownPosition.top}px`,
                                                    right: `${dropdownPosition.right}px`,
                                                }}
                                            >
                                                {validTransitions
                                                    .filter((targetState) => targetState !== currentState)
                                                    .map((targetState) => {
                                                        const actionVerb = StateTransitionHelper.getActionVerb(targetState);
                                                        const targetIcon = StateTransitionHelper.getTransitionIcon(targetState);
                                                        const targetLabel = StateTransitionHelper.getStateLabel(targetState);
                                                        return (
                                                            <button
                                                                key={targetState}
                                                                type="button"
                                                                className="status-dropdown-item"
                                                                onClick={() => handleStateChange(tracking.id, targetState)}
                                                                aria-label={`Change state to ${targetLabel}`}
                                                            >
                                                                <span className="status-dropdown-icon">{targetIcon}</span>
                                                                <span className="status-dropdown-label">{actionVerb}</span>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
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

