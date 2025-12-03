import "./Navigation.css";

export type View = "profile" | "trackings";

interface NavigationProps {
    currentView: View;
    onViewChange: (view: View) => void;
}

/**
 * Navigation component for switching between different views.
 * @param props - Component props
 * @param props.currentView - Currently active view
 * @param props.onViewChange - Callback when view changes
 * @public
 */
export function Navigation({ currentView, onViewChange }: NavigationProps) {
    return (
        <nav className="navigation">
            <button
                type="button"
                className={`nav-button ${currentView === "profile" ? "active" : ""}`}
                onClick={() => onViewChange("profile")}
            >
                Profile
            </button>
            <button
                type="button"
                className={`nav-button ${currentView === "trackings" ? "active" : ""}`}
                onClick={() => onViewChange("trackings")}
            >
                Trackings
            </button>
        </nav>
    );
}

