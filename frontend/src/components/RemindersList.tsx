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

/**
 * RemindersList component for displaying reminders in a table.
 * @public
 */
export function RemindersList() {
    const { reminders, isLoading, updateReminder, snoozeReminder, deleteReminder, refreshReminders } = useReminders();
    const { trackings } = useTrackings();
    const [editingReminder, setEditingReminder] = useState<ReminderData | null>(null);
    const [reminderToDelete, setReminderToDelete] = useState<ReminderData | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const dropdownMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

    /**
     * Get tracking for a reminder.
     * @param trackingId - Tracking ID
     * @returns Tracking data or undefined
     * @internal
     */
    const getTracking = (trackingId: number): TrackingData | undefined => {
        return trackings.find((t) => t.id === trackingId);
    };

    /**
     * Toggle dropdown for a reminder.
     * @param reminderId - Reminder ID
     * @internal
     */
    const toggleDropdown = (reminderId: number) => {
        if (openDropdownId === reminderId) {
            setOpenDropdownId(null);
        } else {
            setOpenDropdownId(reminderId);
            setOpenSnoozeId(null);
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
    };

    /**
     * Handle delete.
     * @param reminder - Reminder data
     * @internal
     */
    const handleDelete = (reminder: ReminderData) => {
        setReminderToDelete(reminder);
        setOpenDropdownId(null);
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
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (isLoading) {
        return <div className="reminders-loading">Loading reminders...</div>;
    }

    return (
        <div className="reminders-list">
            <h2>Reminders</h2>
            {reminders.length === 0 ? (
                <div className="reminders-empty">No reminders</div>
            ) : (
                <div className="reminders-table-container">
                    <table className="reminders-table">
                        <thead>
                            <tr>
                                <th className="col-time">Time</th>
                                <th className="col-tracking">Tracking</th>
                                <th className="col-answer">Answer</th>
                                <th className="col-notes">Notes</th>
                                <th className="col-status">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reminders.map((reminder) => {
                                const tracking = getTracking(reminder.tracking_id);
                                const isDropdownOpen = openDropdownId === reminder.id;
                                const isSnoozeOpen = openSnoozeId === reminder.id;
                                const statusColorClass = ReminderFormatter.getStatusColorClass(reminder.status);

                                return (
                                    <tr key={reminder.id} className="reminder-row">
                                        <td className="cell-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</td>
                                        <td className="cell-tracking">
                                            {tracking ? (
                                                <>
                                                    {tracking.icon && (
                                                        <span className="tracking-icon">{tracking.icon}</span>
                                                    )}
                                                    {tracking.question}
                                                </>
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
                                                {isDropdownOpen && (
                                                    <div
                                                        className="status-dropdown-menu"
                                                        ref={(el) => {
                                                            dropdownMenuRefs.current[reminder.id] = el;
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
            )}
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
                        <h3>Delete Reminder?</h3>
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

