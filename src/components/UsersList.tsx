import { UserData } from '../models/User';

interface UsersListProps {
  users: UserData[];
}

/**
 * Component for displaying the list of created users
 */
export function UsersList({ users }: UsersListProps) {
  /**
   * Escape HTML to prevent XSS attacks
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

