import { UserData } from '../models/User';

interface UsersListProps {
  users: UserData[];
}

/**
 * Component for displaying the list of created users.
 * Shows an empty state when no users exist.
 * @param props - Component props
 * @param props.users - Array of user data to display
 * @public
 */
export function UsersList({ users }: UsersListProps) {
  /**
   * Escape HTML to prevent XSS attacks.
   * @param text - Text to escape
   * @returns Escaped HTML string safe for rendering
   * @internal
   */
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="users-list">
      <h2>Created Users</h2>
      <ul id="usersListItems">
        {users.length === 0 ? (
          <li className="empty-state">No users created yet</li>
        ) : (
          users.map((user) => (
            <li key={user.id}>
              <div className="user-info">
                <span className="user-name">{escapeHtml(user.name)}</span>
                <span className="user-id">ID: {user.id}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

