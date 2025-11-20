import { UserData } from '../models/User';

interface UserProfileProps {
  user: UserData;
}

/**
 * Component for displaying the current user's profile information.
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
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="user-profile">
      <h2>Your Profile</h2>
      <div className="profile-card">
        {user.profile_picture_url && (
          <div className="profile-picture-container">
            <img
              src={user.profile_picture_url}
              alt={`${user.name}'s profile`}
              className="profile-picture"
            />
          </div>
        )}
        <div className="profile-field">
          <label>Name</label>
          <div className="profile-value">{user.name}</div>
        </div>
        {user.email && (
          <div className="profile-field">
            <label>Email</label>
            <div className="profile-value">{user.email}</div>
          </div>
        )}
        <div className="profile-field">
          <label>User ID</label>
          <div className="profile-value">{user.id}</div>
        </div>
        {user.created_at && (
          <div className="profile-field">
            <label>Member Since</label>
            <div className="profile-value">{formatDate(user.created_at)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

