import { useState, useRef, useEffect } from 'react';
import { UserData } from '../models/User';
import './UserMenu.css';

interface UserMenuProps {
    user: UserData;
    onEditProfile: () => void;
    onChangeEmail: () => void;
    onLogout: () => void;
    onDeleteUser: () => void;
}

/**
 * Component for displaying user avatar/menu in the top right corner.
 * Shows circular photo or initials, and dropdown menu on click.
 * @param props - Component props
 * @param props.user - The current user's data
 * @param props.onEditProfile - Callback when Edit Profile is clicked
 * @param props.onLogout - Callback when Logout is clicked
 * @param props.onDeleteUser - Callback when Delete User is clicked
 * @public
 */
export function UserMenu({
    user,
    onEditProfile,
    onChangeEmail,
    onLogout,
    onDeleteUser,
}: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    /**
     * Get user initials from name.
     * @returns Initials string (max 2 characters)
     * @internal
     */
    const getInitials = (): string => {
        const nameParts = user.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
            return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        }
        return user.name.substring(0, 2).toUpperCase();
    };

    /**
     * Close menu when clicking outside.
     * @internal
     */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    /**
     * Toggle menu visibility.
     * @internal
     */
    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    /**
     * Handle menu item click.
     * @param action - Action callback to execute
     * @internal
     */
    const handleMenuItemClick = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <div className="user-menu-container" ref={menuRef}>
            <button
                type="button"
                className="user-menu-button"
                onClick={toggleMenu}
                aria-label="User settings"
                aria-expanded={isOpen}
                title="User settings"
            >
                {user.profile_picture_url ? (
                    <img
                        src={user.profile_picture_url}
                        alt={`${user.name}'s profile`}
                        className="user-avatar"
                    />
                ) : (
                    <div className="user-avatar-initials">{getInitials()}</div>
                )}
            </button>

            {isOpen && (
                <div className="user-menu-dropdown">
                    <button
                        type="button"
                        className="user-menu-item"
                        onClick={() => handleMenuItemClick(onEditProfile)}
                    >
                        Edit profile
                    </button>
                    <button
                        type="button"
                        className="user-menu-item"
                        onClick={() => handleMenuItemClick(onChangeEmail)}
                    >
                        Change email
                    </button>
                    <button
                        type="button"
                        className="user-menu-item"
                        onClick={() => handleMenuItemClick(onLogout)}
                    >
                        Log out
                    </button>
                    <button
                        type="button"
                        className="user-menu-item user-menu-item-danger"
                        onClick={() => handleMenuItemClick(onDeleteUser)}
                    >
                        Delete user
                    </button>
                </div>
            )}
        </div>
    );
}

