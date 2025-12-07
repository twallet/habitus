import { useOutletContext } from 'react-router-dom';
import { TrackingsList } from '../components/TrackingsList';
import { OutletContextType } from '../context/AppContext';

export function TrackingsPage() {
    const {
        trackings,
        trackingsLoading,
        setEditingTracking,
        setShowTrackingForm,
        updateTrackingState,
        deleteTracking
    } = useOutletContext<OutletContextType>();

    return (
        <div className="trackings-view">
            <TrackingsList
                trackings={trackings}
                onEdit={setEditingTracking}
                onCreate={() => setShowTrackingForm(true)}
                isLoading={trackingsLoading}
                onStateChange={updateTrackingState}
                onDelete={deleteTracking}
                onStateChangeSuccess={() => { }} // Handled by global message or optional local
            />
        </div>
    );
}
