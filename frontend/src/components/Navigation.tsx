import { NavLink } from "react-router-dom";
import "./Navigation.css";

export function Navigation({
    runningTrackingsCount,
    pendingRemindersCount,
}: {
    runningTrackingsCount: number;
    pendingRemindersCount: number;
}) {
    return (
        <div className="tabs-header">
            {/* Dashboard tab hidden temporarily */}
            {/* <NavLink
                to="/"
                end
                className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}
            >
                Dashboard
            </NavLink> */}
            <NavLink
                to="/trackings"
                className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}
            >
                Trackings
                {runningTrackingsCount > 0 && (
                    <span
                        className="tab-badge tab-badge-green"
                        aria-label={`${runningTrackingsCount} running trackings`}
                    >
                        {runningTrackingsCount}
                    </span>
                )}
            </NavLink>
            <NavLink
                to="/reminders"
                className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}
            >
                Reminders
                {pendingRemindersCount > 0 && (
                    <span
                        className="tab-badge"
                        aria-label={`${pendingRemindersCount} pending reminders`}
                    >
                        {pendingRemindersCount}
                    </span>
                )}
            </NavLink>
        </div>
    );
}
