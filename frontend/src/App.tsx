import { useState, useEffect } from 'react';
import { Message } from './components/Message';
import { AuthForm } from './components/AuthForm';
import { UserProfile } from './components/UserProfile';
import { useAuth } from './hooks/useAuth';
import { API_ENDPOINTS } from './config/api';
import './App.css';

/**
 * Main application component.
 * Shows login/register screen first, then main app after authentication.
 * @public
 */
function App() {
  const { user, isLoading, isAuthenticated, login, register, logout, setTokenFromCallback } = useAuth();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  /**
   * Handle OAuth callback from Google.
   * Checks URL for token or error and processes accordingly.
   * @internal
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      setTokenFromCallback(token);
      setMessage({
        text: 'Login successful!',
        type: 'success',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setMessage({
        text: decodeURIComponent(error),
        type: 'error',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setTokenFromCallback]);

  /**
   * Handle login form submission.
   * @param email - User's email
   * @param password - User's password
   * @internal
   */
  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      setMessage({
        text: 'Login successful!',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error logging in',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle register form submission.
   * @param name - User's name
   * @param email - User's email
   * @param password - User's password
   * @internal
   */
  const handleRegister = async (name: string, email: string, password: string) => {
    try {
      await register(name, email, password);
      setMessage({
        text: 'Registration successful!',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error registering',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle error messages from form validation.
   * @param errorMessage - Error message to display
   * @internal
   */
  const handleError = (errorMessage: string) => {
    setMessage({
      text: errorMessage,
      type: 'error',
    });
  };

  /**
   * Hide the current message.
   * @internal
   */
  const handleHideMessage = () => {
    setMessage(null);
  };

  /**
   * Handle Google login.
   * Redirects to backend Google OAuth endpoint.
   * @internal
   */
  const handleGoogleLogin = () => {
    window.location.href = API_ENDPOINTS.auth.google;
  };

  /**
   * Handle logout.
   * @internal
   */
  const handleLogout = () => {
    logout();
    setMessage({
      text: 'Logged out successfully',
      type: 'success',
    });
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show login/register screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container">
        <header>
          <h1>Habitus</h1>
          <p className="subtitle">Login or register to get started</p>
        </header>

        <main>
          {message && (
            <Message
              text={message.text}
              type={message.type}
              onHide={handleHideMessage}
            />
          )}

          <AuthForm
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGoogleLogin={handleGoogleLogin}
            onError={handleError}
          />
        </main>
      </div>
    );
  }

  // Show main app if authenticated
  if (!user) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Habitus</h1>
        <p className="subtitle">Welcome to your dashboard</p>
      </header>

      <main>
        <div className="user-info-header">
          <div className="welcome-message">
            Welcome, {user.name}!
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>

        {message && (
          <Message
            text={message.text}
            type={message.type}
            onHide={handleHideMessage}
          />
        )}

        <UserProfile user={user} />
      </main>
    </div>
  );
}

export default App;

