import { UserData } from '../models/User';

interface UserProfileProps {
  user: UserData;
}

/**
 * Component for displaying the current user's profile information.
 * Shows editable fields (name, email) and
 * non-editable fields (id, last_access).
 * @param props - Component props
 * @param props.user - The current user's data
 * @public
 */
export function UserProfile({ user }: UserProfileProps) {
  /**
   * Format date for display.
   * @param dateString - ISO date string
   * @returns Formatted date string
   * @internal
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

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

  return (
    <div className="user-profile">
      <h2>Your Profile</h2>
      <div className="profile-card">
        <div className="profile-picture-container">
          {user.profile_picture_url ? (
            <img
              src={user.profile_picture_url}
              alt={`${user.name}'s profile`}
              className="profile-picture"
            />
          ) : (
            <div className="profile-picture-initials">{getInitials()}</div>
          )}
        </div>
        <div className="profile-section">
          <h3>Editable Information</h3>
          <div className="profile-field">
            <label>Name</label>
            <div className="profile-value">{user.name}</div>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <div className="profile-value">{user.email}</div>
          </div>
        </div>
        <div className="profile-section">
          <h3>System Information (Read-only)</h3>
          <div className="profile-field">
            <label>User ID</label>
            <div className="profile-value">{user.id}</div>
          </div>
          {user.last_access && (
            <div className="profile-field">
              <label>Last Access</label>
              <div className="profile-value">{formatDate(user.last_access)}</div>
            </div>
          )}
          {user.created_at && (
            <div className="profile-field">
              <label>Member Since</label>
              <div className="profile-value">{formatDate(user.created_at)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

