import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { OutletContextType } from '../context/AppContext';
import { ReminderStatus } from '../models/Reminder';
import { ReminderFormatter } from '../components/RemindersList';
import './DashboardPage.css';

export function DashboardPage() {
    const {
        user,
        reminders,
        trackings,
        setShowTrackingForm
    } = useOutletContext<OutletContextType>();

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

    // Calculate completion stats for today
    const stats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const todaysReminders = reminders.filter(reminder => {
            const scheduledTime = new Date(reminder.scheduled_time);
            return scheduledTime >= startOfDay && scheduledTime <= endOfDay;
        });

        const completed = todaysReminders.filter(r => r.status === ReminderStatus.ANSWERED).length;
        const total = todaysReminders.length;

        return { completed, total };
    }, [reminders]);

    const handleReminderClick = (reminderId: number) => {
        // Navigate to reminders page with this reminder highlighted
        window.location.href = `/reminders#reminder-${reminderId}`;
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h2>Hello, {user?.name || 'User'}! 👋</h2>
                <p className="dashboard-subtitle">Here's your focus for today.</p>
            </header>

            <div className="stats-card">
                <div className="stats-content">
                    <div className="stats-info">
                        <h3>Daily Progress</h3>
                        <p>{stats.completed} of {stats.total} habits completed</p>
                    </div>
                    <div className="progress-ring">
                        <div className="progress-bar-bg">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-section">
                <div className="section-header">
                    <h3>Today's Pendings</h3>
                    {todayPendingReminders.length > 0 && <span className="badge">{todayPendingReminders.length}</span>}
                </div>

                {todayPendingReminders.length === 0 ? (
                    <div className="empty-dashboard-state">
                        <p>No pending reminders right now! 🎉</p>
                        <p className="empty-subtitle">Check back later or create a new habit to get started.</p>
                    </div>
                ) : (
                    <div className="dashboard-list">
                        {todayPendingReminders.map(reminder => {
                            const tracking = trackings.find(t => t.id === reminder.tracking_id);
                            return (
                                <div
                                    key={reminder.id}
                                    className="dashboard-card"
                                    onClick={() => handleReminderClick(reminder.id)}
                                >
                                    <div className="card-icon">
                                        {tracking?.icon || '📝'}
                                    </div>
                                    <div className="card-content">
                                        <h4>{tracking?.question || 'Unknown Question'}</h4>
                                        <span className="card-time">{ReminderFormatter.formatDateTime(reminder.scheduled_time)}</span>
                                    </div>
                                    <button className="card-action-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        handleReminderClick(reminder.id);
                                    }}>
                                        Answer
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="dashboard-quick-actions">
                <h3>Quick Actions</h3>
                <button className="action-btn" onClick={() => setShowTrackingForm(true)}>
                    <span className="action-icon">➕</span>
                    Create New Habit
                </button>
            </div>
        </div>
    );
}
