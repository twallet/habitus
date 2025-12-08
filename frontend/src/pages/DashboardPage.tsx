import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { OutletContextType } from '../context/AppContext';
import { ReminderStatus, ReminderData } from '../models/Reminder';
import { ReminderFormatter } from '../components/RemindersList';
import './DashboardPage.css';

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

export function DashboardPage() {
    const {
        reminders,
        trackings,
        updateReminder,
        completeReminder,
        dismissReminder,
        snoozeReminder
    } = useOutletContext<OutletContextType>();

    const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
    const [notesValues, setNotesValues] = useState<Record<number, string>>({});
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const [snoozeDropdownPosition, setSnoozeDropdownPosition] = useState<Record<number, { top: number; left: number }>>({});
    const snoozeDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const snoozeButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const notesTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

    // Filter for today's pending reminders
    const todayPendingReminders = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        return reminders.filter(reminder => {
            const scheduledTime = new Date(reminder.scheduled_time);
            return (
                reminder.status === ReminderStatus.PENDING &&
                scheduledTime >= startOfDay &&
                scheduledTime <= endOfDay &&
                scheduledTime <= now // Only show if time has passed
            );
        }).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
    }, [reminders]);


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
            const target = event.target as HTMLElement;

            // Check if clicking inside any snooze dropdown
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

        if (openSnoozeId !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openSnoozeId]);

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
        } catch (error) {
            console.error("Error updating notes:", error);
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
            await snoozeReminder(reminderId, minutes);
            setOpenSnoozeId(null);
            setSnoozeDropdownPosition(prev => {
                const newPos = { ...prev };
                delete newPos[reminderId];
                return newPos;
            });
        } catch (error) {
            console.error("Error snoozing reminder:", error);
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
        } catch (error) {
            console.error("Error completing reminder:", error);
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
        } catch (error) {
            console.error("Error dismissing reminder:", error);
        }
    };

    return (
        <div className="dashboard">
            <div className="dashboard-section">
                <div className="section-header">
                    <h3>Pending reminders</h3>
                </div>

                {todayPendingReminders.length === 0 ? (
                    <div className="empty-dashboard-state">
                        <p>No pending reminders right now! 🎉</p>
                        <p className="empty-subtitle">Relax and enjoy your day!</p>
                    </div>
                ) : (
                    <div className="dashboard-list">
                        {todayPendingReminders.map(reminder => {
                            const tracking = trackings.find(t => t.id === reminder.tracking_id);

                            return (
                                <div
                                    key={reminder.id}
                                    className="dashboard-card"
                                >
                                    <div className="dashboard-card-top">
                                        <div className="card-icon">
                                            {tracking?.icon || '📝'}
                                        </div>
                                        <div className="card-content">
                                            <h4>{tracking?.question || 'Unknown Question'}</h4>
                                            <span className="card-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</span>
                                        </div>
                                    </div>
                                    <div className="card-notes">
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
                                    </div>
                                    <div className="card-actions-container">
                                        <div className="card-actions-buttons">
                                            <button
                                                type="button"
                                                className="action-button action-complete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleComplete(reminder);
                                                }}
                                                aria-label="Complete reminder"
                                                title="Complete"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                type="button"
                                                className="action-button action-dismiss"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDismiss(reminder);
                                                }}
                                                aria-label="Dismiss reminder"
                                                title="Dismiss"
                                            >
                                                ✕
                                            </button>
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
                                                {openSnoozeId === reminder.id && (
                                                    <div
                                                        className="snooze-dropdown"
                                                        ref={(el) => {
                                                            snoozeDropdownRefs.current[reminder.id] = el;
                                                        }}
                                                        style={snoozeDropdownPosition[reminder.id] ? {
                                                            top: `${snoozeDropdownPosition[reminder.id].top}px`,
                                                            left: `${snoozeDropdownPosition[reminder.id].left}px`,
                                                        } : undefined}
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
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
