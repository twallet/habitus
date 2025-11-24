import { useState, useEffect, useRef } from 'react';
import { Message } from './components/Message';
import { AuthForm } from './components/AuthForm';
import { UserMenu } from './components/UserMenu';
import { EditProfileModal } from './components/EditProfileModal';
import { DeleteUserConfirmationModal } from './components/DeleteUserConfirmationModal';
import { TrackingsList } from './components/TrackingsList';
import { TrackingForm } from './components/TrackingForm';
import { EditTrackingModal } from './components/EditTrackingModal';
import { useAuth } from './hooks/useAuth';
import { useTrackings } from './hooks/useTrackings';
import { TrackingData, TrackingType } from './models/Tracking';
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
  const [editingTracking, setEditingTracking] = useState<TrackingData | null>(null);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const verificationAttempted = useRef(false);

  const {
    trackings,
    isLoading: trackingsLoading,
    createTracking,
    updateTracking,
    deleteTracking,
  } = useTrackings();

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
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Magic link token found in URL, attempting verification`);
      verificationAttempted.current = true;
      // Clean up URL immediately to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname);

      verifyMagicLink(token)
        .then(() => {
          console.log(`[${new Date().toISOString()}] FRONTEND_APP | Magic link verification successful, user logged in`);
          setMessage({
            text: 'Login successful!',
            type: 'success',
          });
        })
        .catch((err) => {
          console.error(`[${new Date().toISOString()}] FRONTEND_APP | Magic link verification failed:`, err);
          setMessage({
            text: err instanceof Error ? err.message : 'Error verifying magic link',
            type: 'error',
          });
        });
    } else if (error) {
      console.warn(`[${new Date().toISOString()}] FRONTEND_APP | Error parameter found in URL: ${error}`);
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link requested via form for email: ${email}`);
    try {
      await requestLoginMagicLink(email);
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link request successful, showing success message`);
      setMessage({
        text: 'If an account exists for this email, a magic link has been sent. Please check your inbox and spam folder.',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link request failed:`, error);
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link requested via form for email: ${email}, name: ${name}`);
    try {
      await requestRegisterMagicLink(name, email, nickname, profilePicture);
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link request successful, showing success message`);
      setMessage({
        text: 'Registration magic link sent! Check your email.',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link request failed:`, error);
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Logout initiated by user`);
    logout();
    verificationAttempted.current = false; // Reset to allow new magic link verification
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Logout completed, showing success message`);
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Profile save initiated by user`);
    try {
      await updateProfile(name, nickname, email, profilePicture);
      setShowEditProfile(false);
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Profile updated successfully, showing success message`);
      setMessage({
        text: 'Profile updated successfully',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Profile update failed:`, error);
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | User account deletion confirmed`);
    try {
      await deleteUser();
      setShowDeleteConfirmation(false);
      verificationAttempted.current = false; // Reset to allow new magic link verification
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | User account deleted successfully, showing success message`);
      setMessage({
        text: 'Account deleted successfully',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | User account deletion failed:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error deleting account',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle create tracking.
   * @internal
   */
  /**
   * Handle create tracking.
   * @param question - Tracking question
   * @param type - Tracking type
   * @param startTrackingDate - Optional start date
   * @param notes - Optional notes
   * @internal
   */
  const handleCreateTracking = async (
    question: string,
    type: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Creating tracking`);
    try {
      await createTracking(question, type, startTrackingDate, notes);
      setShowTrackingForm(false);
      setMessage({
        text: 'Tracking created successfully',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Error creating tracking:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error creating tracking',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle edit tracking.
   * @internal
   */
  const handleEditTracking = (tracking: TrackingData) => {
    setEditingTracking(tracking);
  };

  /**
   * Handle save tracking.
   * @internal
   */
  const handleSaveTracking = async (
    trackingId: number,
    question?: string,
    type?: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Updating tracking ID: ${trackingId}`);
    try {
      await updateTracking(trackingId, question, type, startTrackingDate, notes);
      setEditingTracking(null);
      setMessage({
        text: 'Tracking updated successfully',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Error updating tracking:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error updating tracking',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle delete tracking.
   * @internal
   */
  /**
   * Handle delete tracking.
   * @param trackingId - ID of tracking to delete
   * @internal
   */
  const handleDeleteTracking = async (trackingId: number) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Deleting tracking ID: ${trackingId}`);
    try {
      await deleteTracking(trackingId);
      setEditingTracking(null);
      setMessage({
        text: 'Tracking deleted successfully',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Error deleting tracking:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error deleting tracking',
        type: 'error',
      });
      throw error;
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | App is loading, checking authentication state`);
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show login/register screen if not authenticated
  if (!isAuthenticated) {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | User not authenticated, showing login/register screen`);
    return (
      <div className="container">
        <header>
          <h1>
            <img src="/te-verde.png" alt="🌱" style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }} />
            Habitus
          </h1>
        </header>

        {message && message.type === 'success' && (
          <Message
            text={message.text}
            type={message.type}
            onHide={handleHideMessage}
          />
        )}

        <main>
          {message && message.type === 'error' && (
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
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | User authenticated but user data not loaded, showing loading`);
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  console.log(`[${new Date().toISOString()}] FRONTEND_APP | User authenticated and loaded: ${user.email} (ID: ${user.id}), rendering main app`);

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1>
            <img src="/te-verde.png" alt="🌱" style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }} />
            Habitus
          </h1>
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

      {message && message.type === 'success' && (
        <Message
          text={message.text}
          type={message.type}
          onHide={handleHideMessage}
        />
      )}

      <main>
        <div className="dashboard-header">
          <h2>Your Trackings</h2>
          <p className="dashboard-subtitle">Manage your nanohabit trackings</p>
        </div>

        {message && message.type === 'error' && (
          <Message
            text={message.text}
            type={message.type}
            onHide={handleHideMessage}
          />
        )}

        <div className="trackings-view">
          <TrackingsList
            trackings={trackings}
            onEdit={handleEditTracking}
            isLoading={trackingsLoading}
          />
        </div>

        <button
          type="button"
          className="fab"
          onClick={() => setShowTrackingForm(true)}
          aria-label="Add new tracking"
        >
          +
        </button>
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

      {showTrackingForm && (
        <div className="modal-overlay" onClick={() => setShowTrackingForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Tracking</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowTrackingForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <TrackingForm
              onSubmit={handleCreateTracking}
              onCancel={() => setShowTrackingForm(false)}
              isSubmitting={trackingsLoading}
            />
          </div>
        </div>
      )}

      {editingTracking && (
        <EditTrackingModal
          tracking={editingTracking}
          onClose={() => setEditingTracking(null)}
          onSave={handleSaveTracking}
          onDelete={handleDeleteTracking}
        />
      )}
    </div>
  );
}

export default App;

