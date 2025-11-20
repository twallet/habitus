import { useState, useEffect } from 'react';
import { Message } from './components/Message';
import { AuthForm } from './components/AuthForm';
import { UserProfile } from './components/UserProfile';
import { useAuth } from './hooks/useAuth';
import './App.css';

/**
 * Main application component.
 * Shows login/register screen first, then main app after authentication.
 * @public
 */
function App() {
  const {
    user,
    isLoading,
    isAuthenticated,
    requestLoginMagicLink,
    requestRegisterMagicLink,
    verifyMagicLink,
    logout,
  } = useAuth();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  /**
   * Handle magic link verification from URL.
   * Checks URL for token and verifies it.
   * @internal
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      verifyMagicLink(token)
        .then(() => {
          setMessage({
            text: 'Login successful!',
            type: 'success',
          });
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          setMessage({
            text: err instanceof Error ? err.message : 'Error verifying magic link',
            type: 'error',
          });
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (error) {
      setMessage({
        text: decodeURIComponent(error),
        type: 'error',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [verifyMagicLink]);

  /**
   * Handle login magic link request.
   * @param email - User's email
   * @internal
   */
  const handleRequestLoginMagicLink = async (email: string) => {
    try {
      await requestLoginMagicLink(email);
      setMessage({
        text: 'Magic link sent! Check your email.',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error requesting magic link',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle register magic link request.
   * @param name - User's name
   * @param email - User's email
   * @param nickname - Optional nickname
   * @param profilePicture - Optional profile picture file
   * @internal
   */
  const handleRequestRegisterMagicLink = async (
    name: string,
    email: string,
    nickname?: string,
    profilePicture?: File
  ) => {
    try {
      await requestRegisterMagicLink(name, email, nickname, profilePicture);
      setMessage({
        text: 'Registration magic link sent! Check your email.',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error requesting registration magic link',
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
            onRequestLoginMagicLink={handleRequestLoginMagicLink}
            onRequestRegisterMagicLink={handleRequestRegisterMagicLink}
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

