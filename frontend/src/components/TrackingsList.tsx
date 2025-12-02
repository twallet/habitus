import { TrackingData, TrackingType, DaysPattern, DaysPatternType } from "../models/Tracking";
import "./TrackingsList.css";

interface TrackingsListProps {
    trackings: TrackingData[];
    onEdit: (tracking: TrackingData) => void;
    onCreate?: () => void;
    isLoading?: boolean;
}

/**
 * Format time from hour and minutes to HH:MM string.
 * @param hour - Hour (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Formatted time string
 * @internal
 */
function formatTime(hour: number, minutes: number): string {
    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Format schedules for display (first time + indicator if more).
 * @param schedules - Array of schedule objects
 * @returns Formatted time string
 * @internal
 */
function formatTimesDisplay(schedules?: Array<{ hour: number; minutes: number }>): string {
    if (!schedules || schedules.length === 0) {
        return "";
    }
    const sorted = [...schedules].sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minutes - b.minutes;
    });
    const firstTime = formatTime(sorted[0].hour, sorted[0].minutes);
    if (schedules.length === 1) {
        return firstTime;
    }
    return `${firstTime} +${schedules.length - 1}`;
}

/**
 * Format all schedules for tooltip display.
 * @param schedules - Array of schedule objects
 * @returns Formatted time string with all times
 * @internal
 */
function formatAllTimes(schedules?: Array<{ hour: number; minutes: number }>): string {
    if (!schedules || schedules.length === 0) {
        return "No times";
    }
    const sorted = [...schedules].sort((a, b) => {
        if (a.hour !== b.hour) return a.hour - b.hour;
        return a.minutes - b.minutes;
    });
    return sorted.map((s) => formatTime(s.hour, s.minutes)).join(", ");
}

/**
 * Get type emoji only.
 * @param type - Tracking type
 * @returns Emoji string
 * @internal
 */
function getTypeEmoji(type: TrackingType): string {
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
 * @internal
 */
function getFullTypeLabel(type: TrackingType): string {
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
 * @internal
 */
function formatFrequency(days?: DaysPattern): string {
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
 * @internal
 */
function formatFullFrequency(days?: DaysPattern): string {
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
 * @internal
 */
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + "...";
}

/**
 * Strip HTML tags from text for plain text display in tooltip.
 * @param html - HTML string
 * @returns Plain text
 * @internal
 */
function stripHtml(html: string): string {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
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
    trackings,
    onEdit,
    onCreate,
    isLoading,
}: TrackingsListProps) {
    if (isLoading) {
        return (
            <div className="trackings-list">
                <div className="loading">Loading trackings...</div>
            </div>
        );
    }

    if (trackings.length === 0) {
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
                        <th className="col-icon">Icon</th>
                        <th className="col-question">Question</th>
                        <th className="col-type">Type</th>
                        <th className="col-times">Times</th>
                        <th className="col-frequency">Frequency</th>
                        <th className="col-notes">Notes</th>
                        <th className="col-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {trackings.map((tracking) => (
                        <tr key={tracking.id} className="tracking-row">
                            <td className="cell-icon">
                                {tracking.icon && (
                                    <span className="tracking-icon" title={tracking.icon}>
                                        {tracking.icon}
                                    </span>
                                )}
                            </td>
                            <td className="cell-question" title={tracking.question}>
                                {truncateText(tracking.question, 50)}
                            </td>
                            <td className="cell-type" title={getFullTypeLabel(tracking.type)}>
                                {getTypeEmoji(tracking.type)}
                            </td>
                            <td className="cell-times" title={formatAllTimes(tracking.schedules)}>
                                {formatTimesDisplay(tracking.schedules)}
                            </td>
                            <td className="cell-frequency" title={formatFullFrequency(tracking.days)}>
                                {formatFrequency(tracking.days)}
                            </td>
                            <td className="cell-notes" title={tracking.notes ? stripHtml(tracking.notes) : ""}>
                                {tracking.notes ? "📝" : ""}
                            </td>
                            <td className="cell-actions">
                                <button
                                    type="button"
                                    className="btn-edit-icon"
                                    onClick={() => onEdit(tracking)}
                                    aria-label={`Edit tracking: ${tracking.question}`}
                                    title="Edit tracking"
                                >
                                    ✏️
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

