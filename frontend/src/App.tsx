import { useState, useEffect, useRef } from 'react';
import { Message } from './components/Message';
import { AuthForm } from './components/AuthForm';
import { UserProfile } from './components/UserProfile';
import { UserMenu } from './components/UserMenu';
import { EditProfileModal } from './components/EditProfileModal';
import { DeleteUserConfirmationModal } from './components/DeleteUserConfirmationModal';
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
    updateProfile,
    deleteUser,
  } = useAuth();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const verificationAttempted = useRef(false);

  /**
   * Handle magic link verification from URL.
   * Checks URL for token and verifies it.
   * @internal
   */
  useEffect(() => {
    // Skip if already authenticated or if verification was already attempted
    if (isAuthenticated || verificationAttempted.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      verificationAttempted.current = true;
      // Clean up URL immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);

      verifyMagicLink(token)
        .then(() => {
          setMessage({
            text: 'Login successful!',
            type: 'success',
          });
        })
        .catch((err) => {
          setMessage({
            text: err instanceof Error ? err.message : 'Error verifying magic link',
            type: 'error',
          });
        });
    } else if (error) {
      verificationAttempted.current = true;
      setMessage({
        text: decodeURIComponent(error),
        type: 'error',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [verifyMagicLink, isAuthenticated]);

  /**
   * Handle login magic link request.
   * @param email - User's email
   * @internal
   */
  const handleRequestLoginMagicLink = async (email: string) => {
    try {
      await requestLoginMagicLink(email);
      setMessage({
        text: 'If an account exists for this email, a magic link has been sent. Please check your inbox and spam folder.',
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
    verificationAttempted.current = false; // Reset to allow new magic link verification
    setMessage({
      text: 'Logged out successfully',
      type: 'success',
    });
  };

  /**
   * Handle edit profile.
   * @internal
   */
  const handleEditProfile = () => {
    setShowEditProfile(true);
  };

  /**
   * Handle save profile.
   * @param name - Updated name
   * @param nickname - Updated nickname
   * @param email - Updated email
   * @param profilePicture - Updated profile picture file
   * @internal
   */
  const handleSaveProfile = async (
    name: string,
    nickname: string | undefined,
    email: string,
    profilePicture: File | null
  ) => {
    try {
      await updateProfile(name, nickname, email, profilePicture);
      setShowEditProfile(false);
      setMessage({
        text: 'Profile updated successfully',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error updating profile',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle delete user.
   * @internal
   */
  const handleDeleteUser = () => {
    setShowDeleteConfirmation(true);
  };

  /**
   * Handle confirm delete user.
   * @internal
   */
  const handleConfirmDeleteUser = async () => {
    try {
      await deleteUser();
      setShowDeleteConfirmation(false);
      verificationAttempted.current = false; // Reset to allow new magic link verification
      setMessage({
        text: 'Account deleted successfully',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error deleting account',
        type: 'error',
      });
      throw error;
    }
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
      <header className="app-header">
        <div>
          <h1>Habitus</h1>
          <p className="subtitle">Welcome to your dashboard</p>
        </div>
        {user && (
          <UserMenu
            user={user}
            onEditProfile={handleEditProfile}
            onLogout={handleLogout}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </header>

      <main>
        <div className="welcome-message">
          Welcome, {user.name}!
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

      {showEditProfile && user && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSave={handleSaveProfile}
        />
      )}

      {showDeleteConfirmation && user && (
        <DeleteUserConfirmationModal
          userName={user.name}
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={handleConfirmDeleteUser}
        />
      )}
    </div>
  );
}

export default App;

