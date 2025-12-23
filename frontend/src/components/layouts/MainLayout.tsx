import { useState, useMemo, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTrackings } from '../../hooks/useTrackings';
import { useReminders } from '../../hooks/useReminders';
import { TrackingData, TrackingState } from '../../models/Tracking';
import { ReminderStatus } from '../../models/Reminder';
import { getDailyCitation } from '../../utils/citations';
import { Message } from '../../components/Message';
import { UserMenu } from '../../components/UserMenu';
import { Navigation } from '../../components/Navigation';
import { EditProfileModal } from '../../components/EditProfileModal';
import { ChangeEmailModal } from '../../components/ChangeEmailModal';
import { DeleteUserConfirmationModal } from '../../components/DeleteUserConfirmationModal';
import { TrackingForm } from '../../components/TrackingForm';
import { EditTrackingModal } from '../../components/EditTrackingModal';
import { NotificationsModal } from '../../components/NotificationsModal';
import { DebugLogWindow } from '../../components/DebugLogWindow';
import { OutletContextType } from '../../context/AppContext';

export function MainLayout() {
    const { isAuthenticated, isLoading, user, logout, updateProfile, updateNotificationPreferences, deleteUser, requestEmailChange } = useAuth();

    // State
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [editingTracking, setEditingTracking] = useState<TrackingData | null>(null);
    const [showTrackingForm, setShowTrackingForm] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    const dailyCitation = getDailyCitation();

    // Data Hooks
    const {
        trackings,
        isLoading: trackingsLoading,
        createTracking,
        updateTracking,
        updateTrackingState,
        deleteTracking,
        refreshTrackings,
    } = useTrackings();

    const {
        reminders,
        refreshReminders,
        removeRemindersForTracking,
        updateReminder,
        completeReminder,
        dismissReminder,
        snoozeReminder,
        isLoading: remindersLoading
    } = useReminders();

    // Effects & Memos
    const pendingRemindersCount = useMemo(() => {
        const now = new Date();
        return reminders.filter((reminder) => {
            if (reminder.status === ReminderStatus.ANSWERED) return false;
            if (reminder.status === ReminderStatus.UPCOMING) return false;
            const scheduledTime = new Date(reminder.scheduled_time);
            return reminder.status === ReminderStatus.PENDING && scheduledTime <= now;
        }).length;
    }, [reminders]);


    const runningTrackingsCount = useMemo(() => {
        return trackings.filter((tracking) => tracking.state === TrackingState.RUNNING).length;
    }, [trackings]);

    // Sync Reminders with Deleted Trackings
    useEffect(() => {
        const handleTrackingDeleted = (event: Event) => {
            const customEvent = event as CustomEvent<{ trackingId: number }>;
            const trackingId = customEvent.detail.trackingId;
            removeRemindersForTracking(trackingId);
            refreshReminders();
        };
        window.addEventListener("trackingDeleted", handleTrackingDeleted);
        return () => window.removeEventListener("trackingDeleted", handleTrackingDeleted);
    }, [removeRemindersForTracking, refreshReminders]);

    // Debug Events
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('trackingsChanged'));
    }, [trackings]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('remindersChanged'));
    }, [reminders]);

    // Verify missing trackings
    useEffect(() => {
        if (reminders.length === 0 || trackingsLoading) return;
        const missingTrackingIds = reminders
            .map((r) => r.tracking_id)
            .filter((trackingId) => !trackings.some((t) => t.id === trackingId));
        if (missingTrackingIds.length > 0) {
            refreshTrackings().catch(console.error);
        }
    }, [reminders, trackings, trackingsLoading, refreshTrackings]);


    // Handlers
    const handleHideMessage = () => setMessage(null);

    const handleCreateTracking = async (
        question: string,
        notes: string | undefined,
        icon: string | undefined,
        schedules: Array<{ hour: number; minutes: number }>,
        days: import("../../models/Tracking").DaysPattern | undefined,
        oneTimeDate?: string
    ) => {
        try {
            const result = await createTracking(question, notes, icon, schedules, days, oneTimeDate);
            setShowTrackingForm(false);
            await refreshReminders();
            setMessage({ text: 'Tracking created successfully', type: 'success' });
            return result;
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Error creating tracking', type: 'error' });
            throw error;
        }
    };

    const handleUpdateTracking = async (
        trackingId: number,
        days: import("../../models/Tracking").DaysPattern | undefined,
        question?: string,
        notes?: string,
        icon?: string,
        schedules?: Array<{ hour: number; minutes: number }>
    ) => {
        try {
            const result = await updateTracking(trackingId, days, question, notes, icon, schedules);
            setEditingTracking(null);
            await refreshReminders();
            setMessage({ text: 'Tracking updated successfully', type: 'success' });
            return result;
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Error updating tracking', type: 'error' });
            throw error;
        }
    };

    const handleSaveProfile = async (name: string, profilePicture: File | null, removeProfilePicture?: boolean) => {
        try {
            await updateProfile(name, profilePicture, removeProfilePicture);
            setShowEditProfile(false);
            setMessage({ text: 'Profile updated successfully', type: 'success' });
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Error updating profile', type: 'error' });
        }
    };

    const handleConfirmDeleteUser = async () => {
        try {
            await deleteUser();
            setShowDeleteConfirmation(false);
            setMessage({ text: 'Account deleted successfully', type: 'success' });
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Error deleting account', type: 'error' });
        }
    };

    const handleRequestEmailChange = async (newEmail: string) => {
        try {
            await requestEmailChange(newEmail);
            setShowChangeEmail(false);
            setMessage({ text: 'Confirmation email sent', type: 'success' });
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Error changing email', type: 'error' });
        }
    };

    const handleLogout = () => {
        logout();
        setMessage({ text: 'Logged out successfully', type: 'success' });
    };

    // Render Logic
    if (isLoading) {
        return (
            <div className="container">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // Context Value
    const contextValue: OutletContextType = {
        user,
        trackings,
        trackingsLoading,
        createTracking: handleCreateTracking,
        updateTracking: handleUpdateTracking,
        updateTrackingState: async (id, state) => {
            const result = await updateTrackingState(id, state);
            await refreshReminders();
            setMessage({ text: 'Tracking updated', type: 'success' });
            return result;
        },
        deleteTracking,
        reminders,
        remindersLoading,
        updateReminder,
        completeReminder,
        dismissReminder,
        snoozeReminder,
        setShowTrackingForm,
        setEditingTracking
    };

    return (
        <>
            <div className="container">
                <header className="app-header">
                    <div>
                        <h1>
                            <img
                                src="/assets/images/te-verde.png"
                                alt="🌱"
                                className="habitus-icon"
                                style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }}
                                title={dailyCitation}
                            />
                            Habitus
                        </h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                        <button
                            type="button"
                            className="fab"
                            onClick={() => setShowTrackingForm(true)}
                            aria-label="Create tracking"
                            title="Create tracking"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            className="fab notifications-button"
                            onClick={() => setShowNotifications(true)}
                            aria-label="Configure notifications"
                            title="Configure notifications"
                        >
                            🔔
                        </button>
                        <UserMenu
                            user={user}
                            onEditProfile={() => setShowEditProfile(true)}
                            onChangeEmail={() => setShowChangeEmail(true)}
                            onLogout={handleLogout}
                            onDeleteUser={() => setShowDeleteConfirmation(true)}
                        />
                    </div>
                </header>

                <main>
                    {message && (
                        <Message
                            text={message.text}
                            type={message.type}
                            onHide={handleHideMessage}
                        />
                    )}

                    <div className="tabs-container">
                        <Navigation
                            runningTrackingsCount={runningTrackingsCount}
                            pendingRemindersCount={pendingRemindersCount}
                        />
                        <div className="tabs-content">
                            <Outlet context={contextValue} />
                        </div>
                    </div>
                </main>

                {showEditProfile && (
                    <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={handleSaveProfile} />
                )}
                {showChangeEmail && (
                    <ChangeEmailModal user={user} onClose={() => setShowChangeEmail(false)} onRequestEmailChange={handleRequestEmailChange} />
                )}
                {showDeleteConfirmation && (
                    <DeleteUserConfirmationModal userName={user.name} onClose={() => setShowDeleteConfirmation(false)} onConfirm={handleConfirmDeleteUser} />
                )}
                {showTrackingForm && (
                    <div className="modal-overlay" onClick={() => setShowTrackingForm(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Create tracking</h2>
                                <button type="button" className="modal-close" onClick={() => setShowTrackingForm(false)}>×</button>
                            </div>
                            <TrackingForm
                                onSubmit={async (...args) => { await handleCreateTracking(...args); }}
                                onCancel={() => setShowTrackingForm(false)}
                                isSubmitting={trackingsLoading}
                            />
                        </div>
                    </div>
                )}
                {editingTracking && (
                    <EditTrackingModal
                        tracking={editingTracking}
                        onClose={() => setEditingTracking(null)}
                        onSave={async (...args) => { await handleUpdateTracking(...args); }}
                    />
                )}
                {showNotifications && (
                    <NotificationsModal
                        onClose={() => setShowNotifications(false)}
                        onSave={async (selectedChannels, telegramChatId) => {
                            await updateNotificationPreferences(selectedChannels, telegramChatId);
                            setMessage({ text: 'Notification settings saved', type: 'success' });
                        }}
                        user={user}
                    />
                )}
            </div>
            <DebugLogWindow />
        </>
    );
}
