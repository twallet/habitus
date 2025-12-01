import { TrackingData, TrackingType } from "../models/Tracking";
import "./TrackingsList.css";

interface TrackingsListProps {
    trackings: TrackingData[];
    onEdit: (tracking: TrackingData) => void;
    isLoading?: boolean;
}

/**
 * Component for displaying a list of trackings.
 * Shows tracking cards with question, type, and actions.
 * @param props - Component props
 * @param props.trackings - Array of tracking data
 * @param props.onEdit - Callback when edit button is clicked
 * @param props.isLoading - Whether data is loading
 * @public
 */
export function TrackingsList({
    trackings,
    onEdit,
    isLoading,
}: TrackingsListProps) {
    /**
     * Get display label for tracking type.
     * @param type - Tracking type
     * @returns Display label
     * @internal
     */
    const getTypeLabel = (type: TrackingType): string => {
        switch (type) {
            case TrackingType.TRUE_FALSE:
                return "🔘 Yes/No";
            case TrackingType.REGISTER:
                return "🖊️ Text";
            default:
                return type;
        }
    };

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
                    <p>No trackings yet. Create your first tracking to get started!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="trackings-list">
            <div className="trackings-grid">
                {trackings.map((tracking) => (
                    <div key={tracking.id} className="tracking-card">
                        <div className="tracking-header">
                            <h3 className="tracking-question">
                                {tracking.icon && (
                                    <span className="tracking-icon" style={{ marginRight: "8px" }}>
                                        {tracking.icon}
                                    </span>
                                )}
                                {tracking.question}
                            </h3>
                            <span className={`tracking-type tracking-type-${tracking.type}`}>
                                {getTypeLabel(tracking.type)}
                            </span>
                        </div>
                        <div className="tracking-body">
                            <div className="tracking-info">
                                {tracking.notes && (
                                    <div className="tracking-notes">
                                        <span className="tracking-label">Notes:</span>
                                        <div
                                            className="tracking-notes-content"
                                            dangerouslySetInnerHTML={{ __html: tracking.notes }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="tracking-actions">
                            <button
                                type="button"
                                className="btn-edit"
                                onClick={() => onEdit(tracking)}
                                aria-label={`Edit tracking: ${tracking.question}`}
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

