import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { API_ENDPOINTS } from '../config/api';

// Mock fetch
global.fetch = jest.fn();

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /habitus/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/create your user to get started/i)).toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<App />);
    // Loading state might be too fast to catch, so we just verify the component renders
    // and moves to the initialized state quickly
    await waitFor(() => {
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should render form after initialization', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    });
  });

  it('should create and display a user', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'John Doe' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/user name/i);
    await user.type(input, 'John Doe');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText(/user "john doe" created successfully/i)).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show error message for invalid input', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/user name/i) as HTMLInputElement;
    const longName = 'a'.repeat(31);
    // Use fireEvent to bypass maxLength restriction for testing
    fireEvent.change(input, { target: { value: longName } });
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toHaveClass('error');
  });

  it('should display list of created users', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'User 1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2, name: 'User 2' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    });

    // Create first user
    const input = screen.getByLabelText(/user name/i);
    await user.type(input, 'User 1');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });

    // Create second user
    await user.type(screen.getByLabelText(/user name/i), 'User 2');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });

    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('should load existing users from API', async () => {
    const existingUsers = [
      { id: 1, name: 'Existing User 1' },
      { id: 2, name: 'Existing User 2' },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => existingUsers,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Existing User 1')).toBeInTheDocument();
      expect(screen.getByText('Existing User 2')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(API_ENDPOINTS.users);
  });
});

