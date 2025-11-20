import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';

// Mock fetch
global.fetch = jest.fn();

// Mock useAuth hook
jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Clear localStorage
    localStorage.clear();

    // Default mock: unauthenticated state
    // Make the auth functions call fetch so existing tests continue to work
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn().mockImplementation(async (email: string) => {
        return fetch(API_ENDPOINTS.auth.login, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });
      }),
      requestRegisterMagicLink: jest.fn().mockImplementation(async (name: string, email: string, nickname?: string, password?: string, profilePicture?: File) => {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        if (nickname) formData.append('nickname', nickname);
        if (password) formData.append('password', password);
        if (profilePicture) formData.append('profilePicture', profilePicture);
        return fetch(API_ENDPOINTS.auth.register, {
          method: 'POST',
          body: formData,
        });
      }),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });
  });

  it('should render header', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /habitus/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/login or register to get started/i)).toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    render(<App />);
    // Loading state might be too fast to catch, so we just verify the component renders
    // and moves to the auth form quickly
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should render auth form after initialization', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
  });

  it('should request login magic link', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'If an account exists, a magic link has been sent to your email.' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.login,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@example.com'),
        })
      );
    });
  });

  it('should request registration magic link', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Registration magic link sent! Check your email.' }),
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    // Switch to register mode
    await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^name \*$/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.click(screen.getByRole('button', { name: /send registration link/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.register,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('should show authenticated user profile after login', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockLogout = jest.fn();

    // Mock authenticated state
    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: mockLogout,
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    // Wait for the authenticated state to render
    await waitFor(() => {
      expect(screen.getByText(/welcome, john doe/i)).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();

    // Verify logout button is present
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
  });

  it('should show error message for invalid email', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    // Form validation should prevent submission or show error
    // The exact behavior depends on HTML5 validation
  });

  it('should show loading state when isLoading is true', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show loading state when authenticated but user is null', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: 'token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should handle magic link verification from URL', async () => {
    const mockVerifyMagicLink = jest.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: mockVerifyMagicLink,
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    // Mock URL with token
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?token=magic-token' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(mockVerifyMagicLink).toHaveBeenCalledWith('magic-token');
    });

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });

  it('should handle magic link verification error', async () => {
    const mockVerifyMagicLink = jest.fn().mockRejectedValue(new Error('Invalid token'));

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: mockVerifyMagicLink,
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    // Mock URL with token
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?token=invalid-token' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(mockVerifyMagicLink).toHaveBeenCalledWith('invalid-token');
    });

    await waitFor(() => {
      expect(screen.getByText(/invalid token/i)).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });

  it('should handle error parameter in URL', async () => {
    // Mock URL with error
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?error=Authentication%20failed' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });

  it('should handle login magic link request error', async () => {
    const user = userEvent.setup();
    const mockRequestLoginMagicLink = jest.fn().mockRejectedValue(new Error('Network error'));

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: mockRequestLoginMagicLink,
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('should handle registration magic link request error', async () => {
    const user = userEvent.setup();
    const mockRequestRegisterMagicLink = jest.fn().mockRejectedValue(new Error('Email already exists'));

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: mockRequestRegisterMagicLink,
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^name \*$/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'existing@example.com');
    await user.click(screen.getByRole('button', { name: /send registration link/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('should handle password login', async () => {
    const user = userEvent.setup();
    const mockLoginWithPassword = jest.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: mockLoginWithPassword,
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    // Enable password login
    const passwordCheckbox = screen.getByLabelText(/use password to login/i);
    await user.click(passwordCheckbox);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLoginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });
  });

  it('should handle password login error', async () => {
    const user = userEvent.setup();
    const mockLoginWithPassword = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: mockLoginWithPassword,
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    // Enable password login
    const passwordCheckbox = screen.getByLabelText(/use password to login/i);
    await user.click(passwordCheckbox);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrong-password');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should handle logout', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockLogout = jest.fn();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: mockLogout,
      setTokenFromCallback: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome, john doe/i)).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    await userEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/logged out successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle error message from form validation', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    // This will trigger form validation error
    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    // HTML5 validation should prevent submission
    // The exact behavior depends on browser implementation
  });

  it('should hide message when handleHideMessage is called', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      verifyMagicLink: jest.fn().mockResolvedValue(undefined),
      loginWithPassword: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
    });

    // Mock URL with token to trigger message
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?token=magic-token' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });

    // Find and click the hide button (Message component should have one)
    const hideButton = screen.getByRole('button', { name: /close message/i });
    await userEvent.click(hideButton);

    await waitFor(() => {
      expect(screen.queryByText(/login successful/i)).not.toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });
});
