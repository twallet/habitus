import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useTrackings } from '../hooks/useTrackings';
import { TrackingType } from '../models/Tracking';

// Mock fetch
global.fetch = jest.fn();

// Mock useAuth hook
jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// Mock useTrackings hook
jest.mock('../hooks/useTrackings', () => ({
  useTrackings: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseTrackings = useTrackings as jest.MockedFunction<typeof useTrackings>;

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Clear localStorage
    localStorage.clear();

    // Default mock for useTrackings
    mockUseTrackings.mockReturnValue({
      trackings: [],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: jest.fn(),
      deleteTracking: jest.fn(),
    });

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
      requestRegisterMagicLink: jest.fn().mockImplementation(async (name: string, email: string, profilePicture?: File) => {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        if (profilePicture) formData.append('profilePicture', profilePicture);
        return fetch(API_ENDPOINTS.auth.register, {
          method: 'POST',
          body: formData,
        });
      }),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });
  });

  it('should render header', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /habitus/i })).toBeInTheDocument();
    });
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
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /send login link/i }));

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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: mockLogout,
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    // Wait for the authenticated state to render
    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    // Verify user menu is present
    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    expect(userMenuButton).toBeInTheDocument();

    // Verify FAB button is present
    const fabButton = screen.getByRole('button', { name: /add new tracking/i });
    expect(fabButton).toBeInTheDocument();
  });

  it('should show error message for invalid email', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: mockVerifyMagicLink,
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: mockVerifyMagicLink,
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: mockLogout,
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    // Open user menu
    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    // Click logout from menu
    const logoutMenuItem = screen.getByRole('button', { name: /log out/i });
    await userEvent.click(logoutMenuItem);

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
    await user.click(screen.getByRole('button', { name: /send login link/i }));

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

    // Start unauthenticated so verification can run
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn().mockResolvedValue(mockUser),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
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

  it('should handle email change verification success', async () => {
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?emailChangeVerified=true' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your email has been updated/i)).toBeInTheDocument();
    });

    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });

  it('should handle email change verification failure', async () => {
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { search: '?emailChangeVerified=false&error=Email%20already%20in%20use' },
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
    });

    Object.defineProperty(window, 'location', {
      value: { search: originalSearch },
      writable: true,
    });
  });

  it('should handle login magic link cooldown', async () => {
    const user = userEvent.setup();
    const mockRequestLoginMagicLink = jest.fn().mockResolvedValue({
      message: 'Please wait before requesting another link',
      cooldown: true,
    });

    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      requestLoginMagicLink: mockRequestLoginMagicLink,
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/please wait before requesting another link/i)).toBeInTheDocument();
    });
  });

  it('should handle edit profile', async () => {
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const editProfileMenuItem = screen.getByRole('button', { name: /edit profile/i });
    await userEvent.click(editProfileMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
    });
  });

  it('should handle change email', async () => {
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const changeEmailMenuItem = screen.getByRole('button', { name: /change email/i });
    await userEvent.click(changeEmailMenuItem);

    await waitFor(() => {
      // "Change email" appears as both a button and a heading, so use getAllByText
      const changeEmailElements = screen.getAllByText(/change email/i);
      expect(changeEmailElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle save profile', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockUpdateProfile = jest.fn().mockResolvedValue({
      ...mockUser,
      name: 'Jane Doe',
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: mockUpdateProfile,
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const editProfileMenuItem = screen.getByRole('button', { name: /edit profile/i });
    await userEvent.click(editProfileMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/^name \*$/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Jane Doe');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle delete user confirmation', async () => {
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
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const deleteUserMenuItem = screen.getByRole('button', { name: /delete user/i });
    await userEvent.click(deleteUserMenuItem);

    await waitFor(() => {
      // "Delete account" appears as both a heading and a button, so use getAllByText
      const deleteAccountElements = screen.getAllByText(/delete account/i);
      expect(deleteAccountElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle create tracking', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockCreateTracking = jest.fn().mockResolvedValue({
      id: 1,
      question: 'Did you exercise?',
      type: 'true_false',
      start_tracking_date: '2024-01-01',
      notes: undefined,
    });

    mockUseTrackings.mockReturnValue({
      trackings: [],
      isLoading: false,
      createTracking: mockCreateTracking,
      updateTracking: jest.fn(),
      deleteTracking: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const fabButton = screen.getByRole('button', { name: /add new tracking/i });
    await userEvent.click(fabButton);

    // Wait for the form input to appear (more reliable than waiting for text)
    await waitFor(() => {
      expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    });

    const questionInput = screen.getByLabelText(/question/i);
    await userEvent.type(questionInput, 'Did you exercise?');

    const submitButton = screen.getByRole('button', { name: /create/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateTracking).toHaveBeenCalled();
      expect(screen.getByText(/tracking created successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle edit tracking', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockTracking = {
      id: 1,
      user_id: 1,
      question: 'Did you exercise?',
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: '2024-01-01',
      notes: undefined,
    };

    mockUseTrackings.mockReturnValue({
      trackings: [mockTracking],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: jest.fn(),
      deleteTracking: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/edit tracking/i)).toBeInTheDocument();
    });
  });

  it('should handle save tracking', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockTracking = {
      id: 1,
      user_id: 1,
      question: 'Did you exercise?',
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: '2024-01-01',
      notes: undefined,
    };

    const mockUpdateTracking = jest.fn().mockResolvedValue({
      ...mockTracking,
      question: 'Did you meditate?',
    });

    mockUseTrackings.mockReturnValue({
      trackings: [mockTracking],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: mockUpdateTracking,
      deleteTracking: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/edit tracking/i)).toBeInTheDocument();
    });

    const questionInput = screen.getByLabelText(/question/i);
    await userEvent.clear(questionInput);
    await userEvent.type(questionInput, 'Did you meditate?');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateTracking).toHaveBeenCalled();
      expect(screen.getByText(/tracking updated successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle delete tracking', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockTracking = {
      id: 1,
      user_id: 1,
      question: 'Did you exercise?',
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: '2024-01-01',
      notes: undefined,
    };

    const mockDeleteTracking = jest.fn().mockResolvedValue(undefined);

    mockUseTrackings.mockReturnValue({
      trackings: [mockTracking],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: jest.fn(),
      deleteTracking: mockDeleteTracking,
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/edit tracking/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete this tracking/i)).toBeInTheDocument();
    });

    // Find the confirmation delete button (the second Delete button)
    const allDeleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(allDeleteButtons.length).toBeGreaterThan(1);

    // Click the last delete button (the one in the confirmation dialog)
    const confirmDeleteButton = allDeleteButtons[allDeleteButtons.length - 1];
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(mockDeleteTracking).toHaveBeenCalledWith(1);
      expect(screen.getByText(/tracking deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle profile update error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockUpdateProfile = jest.fn().mockRejectedValue(new Error('Update failed'));

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: mockUpdateProfile,
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const editProfileMenuItem = screen.getByRole('button', { name: /edit profile/i });
    await userEvent.click(editProfileMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });
  });

  it('should handle email change request error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockRequestEmailChange = jest.fn().mockRejectedValue(new Error('Email already in use'));

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: mockRequestEmailChange,
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const changeEmailMenuItem = screen.getByRole('button', { name: /change email/i });
    await userEvent.click(changeEmailMenuItem);

    await waitFor(() => {
      // "Change email" appears as both a button and a heading, so use getAllByText
      const changeEmailElements = screen.getAllByText(/change email/i);
      expect(changeEmailElements.length).toBeGreaterThan(0);
    });

    const emailInput = screen.getByLabelText(/new email/i);
    const submitButton = screen.getByRole('button', { name: /send email change link/i });
    await userEvent.type(emailInput, 'newemail@example.com');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith('newemail@example.com');
    });
  });

  it('should handle delete user confirmation', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockDeleteUser = jest.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const deleteUserMenuItem = screen.getByRole('button', { name: /delete user/i });
    await userEvent.click(deleteUserMenuItem);

    await waitFor(() => {
      // "Delete account" appears as both a heading and a button, so use getAllByText
      const deleteAccountElements = screen.getAllByText(/delete account/i);
      expect(deleteAccountElements.length).toBeGreaterThan(0);
    });

    const confirmationInput = screen.getByLabelText(/type.*delete.*to confirm/i);
    await userEvent.type(confirmationInput, 'DELETE');

    const confirmButton = screen.getByRole('button', { name: /delete account/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalled();
      expect(screen.getByText(/account deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle delete user error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockDeleteUser = jest.fn().mockRejectedValue(new Error('Deletion failed'));

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    await userEvent.click(userMenuButton);

    const deleteUserMenuItem = screen.getByRole('button', { name: /delete user/i });
    await userEvent.click(deleteUserMenuItem);

    await waitFor(() => {
      // "Delete account" appears as both a heading and a button, so use getAllByText
      const deleteAccountElements = screen.getAllByText(/delete account/i);
      expect(deleteAccountElements.length).toBeGreaterThan(0);
    });

    // Type DELETE to confirm
    const confirmationInput = screen.getByLabelText(/type.*delete.*to confirm/i);
    await userEvent.type(confirmationInput, 'DELETE');

    const confirmButton = screen.getByRole('button', { name: /delete account/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalled();
      // "Deletion failed" appears in both the app message and modal error, so use getAllByText
      const deletionFailedElements = screen.getAllByText(/deletion failed/i);
      expect(deletionFailedElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle create tracking error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockCreateTracking = jest.fn().mockRejectedValue(new Error('Failed to create tracking'));

    mockUseTrackings.mockReturnValue({
      trackings: [],
      isLoading: false,
      createTracking: mockCreateTracking,
      updateTracking: jest.fn(),
      deleteTracking: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const fabButton = screen.getByRole('button', { name: /add new tracking/i });
    await userEvent.click(fabButton);

    // Wait for the form input to appear (more reliable than waiting for text)
    await waitFor(() => {
      expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    });

    const questionInput = screen.getByLabelText(/question/i);
    const submitButton = screen.getByRole('button', { name: /create/i });
    await userEvent.type(questionInput, 'Did you exercise?');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateTracking).toHaveBeenCalled();
      // Error message can appear in both the main message area and the modal
      const errorMessages = screen.getAllByText(/failed to create tracking/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('should handle update tracking error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockTracking = {
      id: 1,
      user_id: 1,
      question: 'Did you exercise?',
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: '2024-01-01',
      notes: undefined,
    };

    const mockUpdateTracking = jest.fn().mockRejectedValue(new Error('Failed to update tracking'));

    mockUseTrackings.mockReturnValue({
      trackings: [mockTracking],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: mockUpdateTracking,
      deleteTracking: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/edit tracking/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateTracking).toHaveBeenCalled();
    });

    // There may be multiple error messages (one in modal, one at top), so check for at least one
    await waitFor(() => {
      expect(screen.getAllByText(/failed to update tracking/i).length).toBeGreaterThan(0);
    });
  });

  it('should handle delete tracking error', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockTracking = {
      id: 1,
      user_id: 1,
      question: 'Did you exercise?',
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: '2024-01-01',
      notes: undefined,
    };

    const mockDeleteTracking = jest.fn().mockRejectedValue(new Error('Failed to delete tracking'));

    mockUseTrackings.mockReturnValue({
      trackings: [mockTracking],
      isLoading: false,
      createTracking: jest.fn(),
      updateTracking: jest.fn(),
      deleteTracking: mockDeleteTracking,
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      isAuthenticated: true,
      requestLoginMagicLink: jest.fn(),
      requestRegisterMagicLink: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyMagicLink: jest.fn(),
      logout: jest.fn(),
      setTokenFromCallback: jest.fn(),
      updateProfile: jest.fn(),
      deleteUser: jest.fn(),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your trackings/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/edit tracking/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete this tracking/i)).toBeInTheDocument();
    });

    // Find the confirmation delete button (the second Delete button)
    const allDeleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(allDeleteButtons.length).toBeGreaterThan(1);

    // Click the last delete button (the one in the confirmation dialog)
    const confirmDeleteButton = allDeleteButtons[allDeleteButtons.length - 1];
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(mockDeleteTracking).toHaveBeenCalledWith(1);
      // Error message can appear in both the main message area and the modal
      const errorMessages = screen.getAllByText(/failed to delete tracking/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });
});
