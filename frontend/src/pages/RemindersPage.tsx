import { useOutletContext } from 'react-router-dom';
import { RemindersList } from '../components/RemindersList';
import { OutletContextType } from '../context/AppContext';

export function RemindersPage() {
    const {
        trackings,
        trackingsLoading,
        reminders,
        remindersLoading,
        updateReminder,
        completeReminder,
        dismissReminder,
        snoozeReminder,
        setShowTrackingForm
    } = useOutletContext<OutletContextType>();

    return (
        <div className="reminders-view">
            <RemindersList
                trackings={trackings}
                isLoadingTrackings={trackingsLoading}
                reminders={reminders}
                isLoadingReminders={remindersLoading}
                updateReminder={updateReminder}
                completeReminder={completeReminder}
                dismissReminder={dismissReminder}
                snoozeReminder={snoozeReminder}
                onCreate={() => setShowTrackingForm(true)}
                onMessage={() => { }} // Messages handled globally or we can add to context if needed
            />
        </div>
    );
}
