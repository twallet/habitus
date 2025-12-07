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
        <nav className="tabs-header">
            <NavLink
                to="/"
                className={({ isActive }) => `tab-button ${isActive ? "active" : ""}`}
                end
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
                className={({ isActive }) => `tab-button ${isActive ? "active" : ""}`}
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
        </nav>
    );
}


