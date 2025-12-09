import { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { OutletContextType } from '../context/AppContext';
import { ReminderStatus, ReminderData } from '../models/Reminder';
import { ReminderFormatter } from '../components/RemindersList';
import { Message } from '../components/Message';
import './DashboardPage.css';

/**
 * Format time difference as readable countdown string.
 * @param targetTime - Target date/time
 * @param currentTime - Current date/time (defaults to now)
 * @returns Formatted countdown string (XX days XX hours XX min) or null if target is in the past
 * @internal
 */
function formatCountdown(targetTime: Date, currentTime: Date = new Date()): string | null {
    const diff = targetTime.getTime() - currentTime.getTime();
    if (diff <= 0) {
        return null;
    }

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }
    if (hours > 0) {
        parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }
    if (minutes > 0 || parts.length === 0) {
        parts.push(`${minutes} ${minutes === 1 ? 'min' : 'min'}`);
    }

    return parts.join(' ');
}

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

    const [searchParams, setSearchParams] = useSearchParams();
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
    const [notesValues, setNotesValues] = useState<Record<number, string>>({});
    const [openSnoozeId, setOpenSnoozeId] = useState<number | null>(null);
    const [snoozeDropdownPosition, setSnoozeDropdownPosition] = useState<Record<number, { top: number; left: number }>>({});
    const [showSnoozeModal, setShowSnoozeModal] = useState<number | null>(null);
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

    // Find the next upcoming reminder (PENDING with future time or UPCOMING status)
    const nextReminder = useMemo(() => {
        const now = new Date();
        const futureReminders = reminders
            .filter(reminder => {
                const scheduledTime = new Date(reminder.scheduled_time);
                return (
                    (reminder.status === ReminderStatus.PENDING && scheduledTime > now) ||
                    reminder.status === ReminderStatus.UPCOMING
                );
            })
            .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());

        return futureReminders.length > 0 ? futureReminders[0] : null;
    }, [reminders]);

    // Countdown state that updates every minute
    const [countdown, setCountdown] = useState<string | null>(null);

    useEffect(() => {
        if (!nextReminder) {
            setCountdown(null);
            return;
        }

        const updateCountdown = () => {
            const targetTime = new Date(nextReminder.scheduled_time);
            const formatted = formatCountdown(targetTime);
            setCountdown(formatted);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [nextReminder]);


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
     * Handle complete.
     * @param reminder - Reminder data
     * @internal
     */
    const handleComplete = useCallback(async (reminder: ReminderData) => {
        // Check if reminder is still pending
        if (reminder.status !== ReminderStatus.PENDING) {
            setMessage({
                text: 'This reminder has already been resolved.',
                type: 'error'
            });
            return;
        }

        try {
            await completeReminder(reminder.id);
            setMessage({
                text: 'Reminder completed successfully',
                type: 'success'
            });
        } catch (error) {
            console.error("Error completing reminder:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error completing reminder';

            // Check if error is about reminder already resolved
            if (errorMessage.includes('already been resolved') ||
                errorMessage.includes('Cannot transition from Answered') ||
                errorMessage.includes('Cannot transition to the same status')) {
                setMessage({
                    text: 'This reminder has already been resolved.',
                    type: 'error'
                });
            } else {
                setMessage({
                    text: errorMessage,
                    type: 'error'
                });
            }
        }
    }, [completeReminder]);

    /**
     * Handle dismiss.
     * @param reminder - Reminder data
     * @internal
     */
    const handleDismiss = useCallback(async (reminder: ReminderData) => {
        // Check if reminder is still pending
        if (reminder.status !== ReminderStatus.PENDING) {
            setMessage({
                text: 'This reminder has already been resolved.',
                type: 'error'
            });
            return;
        }

        try {
            await dismissReminder(reminder.id);
            setMessage({
                text: 'Reminder dismissed successfully',
                type: 'success'
            });
        } catch (error) {
            console.error("Error dismissing reminder:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error dismissing reminder';

            // Check if error is about reminder already resolved
            if (errorMessage.includes('already been resolved') ||
                errorMessage.includes('Cannot transition from Answered') ||
                errorMessage.includes('Cannot transition to the same status')) {
                setMessage({
                    text: 'This reminder has already been resolved.',
                    type: 'error'
                });
            } else {
                setMessage({
                    text: errorMessage,
                    type: 'error'
                });
            }
        }
    }, [dismissReminder]);

    /**
     * Handle action parameters from email links.
     * @internal
     */
    useEffect(() => {
        const action = searchParams.get('action');
        const reminderIdParam = searchParams.get('reminderId');
        const notesParam = searchParams.get('notes');

        if (action && reminderIdParam) {
            const reminderId = parseInt(reminderIdParam, 10);
            const reminder = reminders.find(r => r.id === reminderId);

            if (!reminder) {
                // Reminder not found
                setMessage({
                    text: 'Reminder not found. It may have been deleted.',
                    type: 'error'
                });
                setSearchParams({});
                return;
            }

            if (reminder.status !== ReminderStatus.PENDING) {
                // Reminder already resolved
                setMessage({
                    text: 'This reminder has already been resolved.',
                    type: 'error'
                });
                setSearchParams({});
                return;
            }

            // If notes are provided, save them first
            const saveNotesAndAction = async () => {
                if (notesParam !== null) {
                    try {
                        const decodedNotes = decodeURIComponent(notesParam);
                        await updateReminder(reminderId, decodedNotes);
                        // Update local state
                        setNotesValues(prev => ({
                            ...prev,
                            [reminderId]: decodedNotes
                        }));
                    } catch (error) {
                        console.error("Error updating notes from email:", error);
                        setMessage({
                            text: 'Error saving notes. The action will proceed without updating notes.',
                            type: 'error'
                        });
                    }
                }
            };

            // Reminder is pending, proceed with action
            if (action === 'complete') {
                saveNotesAndAction().then(() => {
                    return handleComplete(reminder);
                }).finally(() => {
                    // Clear URL parameters after action
                    setSearchParams({});
                });
            } else if (action === 'dismiss') {
                saveNotesAndAction().then(() => {
                    return handleDismiss(reminder);
                }).finally(() => {
                    // Clear URL parameters after action
                    setSearchParams({});
                });
            } else if (action === 'snooze') {
                // Save notes first if provided
                saveNotesAndAction().then(() => {
                    // Show snooze modal for email actions
                    setShowSnoozeModal(reminderId);
                    // Clear action and notes parameters but keep reminderId for modal
                    setSearchParams({ reminderId: reminderIdParam });
                });
            } else if (action === 'editNotes') {
                // Focus on notes textarea for this reminder
                if (notesParam !== null) {
                    const decodedNotes = decodeURIComponent(notesParam);
                    setNotesValues(prev => ({
                        ...prev,
                        [reminderId]: decodedNotes
                    }));
                }
                setEditingNotesId(reminderId);
                // Scroll to the reminder card and focus the textarea
                setTimeout(() => {
                    const textarea = notesTextareaRefs.current[reminderId];
                    if (textarea) {
                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        textarea.focus();
                    }
                }, 100);
                // Clear URL parameters after focusing
                setSearchParams({});
            }
        }
    }, [searchParams, reminders, setSearchParams, updateReminder, handleComplete, handleDismiss]);

    /**
     * Close dropdowns when clicking outside.
     * @internal
     */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Check if clicking on a snooze dropdown item (button)
            if (target.classList.contains('snooze-dropdown-item')) {
                return;
            }

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
            // Use click instead of mousedown to allow the button click to process first
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [openSnoozeId]);

    /**
     * Handle saving notes.
     * @param reminderId - Reminder ID
     * @internal
     */
    const handleSaveNotes = async (reminderId: number) => {
        const notesToSave = notesValues[reminderId] ?? "";
        const reminder = reminders.find(r => r.id === reminderId);

        // Check if reminder is still pending
        if (reminder && reminder.status !== ReminderStatus.PENDING) {
            setMessage({
                text: 'Cannot edit notes. This reminder has already been resolved.',
                type: 'error'
            });
            setEditingNotesId(null);
            return;
        }

        try {
            await updateReminder(reminderId, notesToSave);
            setEditingNotesId(null);
            setMessage({
                text: 'Notes updated successfully',
                type: 'success'
            });
        } catch (error) {
            console.error("Error updating notes:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error updating notes';

            // Check if error is about reminder already resolved
            if (errorMessage.includes('already been resolved') ||
                errorMessage.includes('Cannot transition from Answered')) {
                setMessage({
                    text: 'Cannot edit notes. This reminder has already been resolved.',
                    type: 'error'
                });
            } else {
                setMessage({
                    text: errorMessage,
                    type: 'error'
                });
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
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
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
            });
        }
    }, [openSnoozeId]);

    /**
     * Handle snooze.
     * @param reminderId - Reminder ID
     * @param minutes - Minutes to snooze
     * @internal
     */
    const handleSnooze = async (reminderId: number, minutes: number) => {
        const reminder = reminders.find(r => r.id === reminderId);

        // Check if reminder is still pending
        if (reminder && reminder.status !== ReminderStatus.PENDING) {
            setMessage({
                text: 'Cannot snooze. This reminder has already been resolved.',
                type: 'error'
            });
            setOpenSnoozeId(null);
            return;
        }

        try {
            await snoozeReminder(reminderId, minutes);
            setOpenSnoozeId(null);
            setSnoozeDropdownPosition(prev => {
                const newPos = { ...prev };
                delete newPos[reminderId];
                return newPos;
            });
            setMessage({
                text: 'Reminder snoozed successfully',
                type: 'success'
            });
        } catch (error) {
            console.error("Error snoozing reminder:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error snoozing reminder';

            // Check if error is about reminder already resolved
            if (errorMessage.includes('already been resolved') ||
                errorMessage.includes('Cannot transition from Answered')) {
                setMessage({
                    text: 'Cannot snooze. This reminder has already been resolved.',
                    type: 'error'
                });
            } else {
                setMessage({
                    text: errorMessage,
                    type: 'error'
                });
            }
        }
    };


    /**
     * Handle snooze from modal (email action).
     * @param reminderId - Reminder ID
     * @param minutes - Minutes to snooze
     * @internal
     */
    const handleSnoozeFromModal = async (reminderId: number, minutes: number) => {
        const reminder = reminders.find(r => r.id === reminderId);

        // Check if reminder is still pending
        if (reminder && reminder.status !== ReminderStatus.PENDING) {
            setMessage({
                text: 'Cannot snooze. This reminder has already been resolved.',
                type: 'error'
            });
            setShowSnoozeModal(null);
            setSearchParams({});
            return;
        }

        try {
            await snoozeReminder(reminderId, minutes);
            setShowSnoozeModal(null);
            setSearchParams({});
            setMessage({
                text: 'Reminder snoozed successfully',
                type: 'success'
            });
        } catch (error) {
            console.error("Error snoozing reminder:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error snoozing reminder';

            // Check if error is about reminder already resolved
            if (errorMessage.includes('already been resolved') ||
                errorMessage.includes('Cannot transition from Answered')) {
                setMessage({
                    text: 'Cannot snooze. This reminder has already been resolved.',
                    type: 'error'
                });
            } else {
                setMessage({
                    text: errorMessage,
                    type: 'error'
                });
            }
            setShowSnoozeModal(null);
            setSearchParams({});
        }
    };

    return (
        <div className="dashboard">
            {message && (
                <Message
                    text={message.text}
                    type={message.type}
                    onHide={() => setMessage(null)}
                />
            )}
            <div className="dashboard-section">
                <div className="section-header">
                    <h3>Pending reminders</h3>
                </div>

                {todayPendingReminders.length === 0 ? (
                    <div className="empty-dashboard-state">
                        <p>No pending reminders right now! 🎉</p>
                        {countdown ? (
                            <p className="empty-subtitle">Next reminder in {countdown}</p>
                        ) : (
                            <p className="empty-subtitle">No upcoming reminders scheduled</p>
                        )}
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
                                                {openSnoozeId === reminder.id && snoozeDropdownPosition[reminder.id] && createPortal(
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
                                                    </div>,
                                                    document.body
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

            {/* Snooze Modal for Email Actions */}
            {showSnoozeModal !== null && createPortal(
                <div
                    className="modal-overlay"
                    onClick={() => {
                        setShowSnoozeModal(null);
                        setSearchParams({});
                    }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        className="snooze-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '24px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                    >
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>
                            Snooze Reminder
                        </h3>
                        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>
                            Select how long you want to snooze this reminder:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {SNOOZE_OPTIONS.map((option) => (
                                <button
                                    key={option.minutes}
                                    type="button"
                                    onClick={() => handleSnoozeFromModal(showSnoozeModal, option.minutes)}
                                    style={{
                                        padding: '12px 16px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        textAlign: 'left',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'white';
                                    }}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSnoozeModal(null);
                                setSearchParams({});
                            }}
                            style={{
                                marginTop: '16px',
                                padding: '8px 16px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                backgroundColor: '#f5f5f5',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
