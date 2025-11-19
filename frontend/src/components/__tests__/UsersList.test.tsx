import { render, screen } from '@testing-library/react';
import { UsersList } from '../UsersList';
import { UserData } from '../../models/User';

describe('UsersList', () => {
  it('should render empty state when no users', () => {
    render(<UsersList users={[]} />);

    expect(screen.getByText(/no users created yet/i)).toBeInTheDocument();
  });

  it('should render list of users', () => {
    const users: UserData[] = [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
      { id: 3, name: 'Bob Johnson' },
    ];

    render(<UsersList users={users} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

    expect(screen.getByText(/id: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/id: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/id: 3/i)).toBeInTheDocument();
  });

  it('should escape HTML in user names to prevent XSS', () => {
    const users: UserData[] = [
      { id: 1, name: '<script>alert("xss")</script>' },
      { id: 2, name: '<img src="x" onerror="alert(1)">' },
    ];

    render(<UsersList users={users} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);

    // The script tags should be escaped and displayed as text (not executed)
    // The escapeHtml function converts HTML entities, so we check the textContent
    // which will contain the escaped HTML entities
    const firstItem = listItems[0];
    expect(firstItem.textContent).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');
    
    const secondItem = listItems[1];
    expect(secondItem.textContent).toContain('&lt;img src="x" onerror="alert(1)"&gt;');
    
    // Verify that no actual script tags exist in the DOM (they should be escaped)
    const scriptElements = document.querySelectorAll('script');
    expect(scriptElements.length).toBe(0);
    
    // Verify that no img tags with onerror exist
    const imgElements = document.querySelectorAll('img[onerror]');
    expect(imgElements.length).toBe(0);
  });

  it('should render heading', () => {
    render(<UsersList users={[]} />);

    expect(screen.getByRole('heading', { name: /created users/i })).toBeInTheDocument();
  });

  it('should render users in correct order', () => {
    const users: UserData[] = [
      { id: 3, name: 'Third' },
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
    ];

    render(<UsersList users={users} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent('Third');
    expect(listItems[1]).toHaveTextContent('First');
    expect(listItems[2]).toHaveTextContent('Second');
  });
});

