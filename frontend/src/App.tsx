import { useState, useEffect, useRef } from 'react';
import { Message } from './components/Message';
import { AuthForm } from './components/AuthForm';
import { UserMenu } from './components/UserMenu';
import { EditProfileModal } from './components/EditProfileModal';
import { ChangeEmailModal } from './components/ChangeEmailModal';
import { DeleteUserConfirmationModal } from './components/DeleteUserConfirmationModal';
import { TrackingsList } from './components/TrackingsList';
import { TrackingForm } from './components/TrackingForm';
import { EditTrackingModal } from './components/EditTrackingModal';
import { RemindersList } from './components/RemindersList';
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
    requestEmailChange,
    verifyMagicLink,
    logout,
    updateProfile,
    deleteUser,
  } = useAuth();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [editingTracking, setEditingTracking] = useState<TrackingData | null>(null);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'trackings' | 'reminders'>('trackings');
  const verificationAttempted = useRef(false);
  const trackingsViewRef = useRef<HTMLDivElement>(null);
  const remindersViewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    trackings,
    isLoading: trackingsLoading,
    createTracking,
    updateTracking,
    updateTrackingState,
    deleteTracking,
  } = useTrackings();

  /**
   * Update container width and height to match the maximum dimensions between trackings and reminders tables.
   * @internal
   */
  useEffect(() => {
    const measureView = (view: HTMLElement): { width: number; height: number } => {
      const wasHidden = view.style.display === 'none';
      const originalStyles = {
        display: view.style.display,
        visibility: view.style.visibility,
        position: view.style.position,
        left: view.style.left,
        top: view.style.top,
      };

      // Temporarily show the view if hidden to get accurate measurement
      if (wasHidden) {
        view.style.display = 'block';
        view.style.visibility = 'hidden';
        view.style.position = 'absolute';
        view.style.left = '-9999px';
        view.style.top = '0';
        // Force multiple reflows to ensure all content (including empty states) is measured
        void view.offsetHeight;
        void view.offsetHeight;
        // Small delay to ensure empty states are rendered
        // Use a synchronous approach by reading layout properties
        const computedStyle = window.getComputedStyle(view);
        void computedStyle.height;
      }

      // Measure table width (if table exists)
      const table = view.querySelector('.trackings-table') || view.querySelector('.reminders-table');
      let tableWidth = 0;
      if (table) {
        const rect = table.getBoundingClientRect();
        tableWidth = rect.width > 0 ? rect.width : 0;
      } else {
        // If no table, measure the view container width for empty states
        const rect = view.getBoundingClientRect();
        tableWidth = rect.width > 0 ? rect.width : 0;
      }

      // Measure entire view height (including filters, empty states, etc.)
      // For empty states, we need to measure the entire view container
      // Use scrollHeight for content height, offsetHeight for element height
      // Also check the list content container if it exists
      const listContent = view.querySelector('.trackings-list-content') || view.querySelector('.reminders-list-content');
      let viewHeight = Math.max(view.scrollHeight, view.offsetHeight);

      if (listContent) {
        const contentHeight = Math.max(
          (listContent as HTMLElement).scrollHeight,
          (listContent as HTMLElement).offsetHeight
        );
        viewHeight = Math.max(viewHeight, contentHeight);
      }

      // Also measure empty state containers if they exist
      const emptyState = view.querySelector('.empty-state') || view.querySelector('.reminders-empty');
      if (emptyState) {
        const emptyHeight = Math.max(
          (emptyState as HTMLElement).scrollHeight,
          (emptyState as HTMLElement).offsetHeight
        );
        // Add some margin for empty states
        viewHeight = Math.max(viewHeight, emptyHeight + 40);
      }

      // Restore original state
      if (wasHidden) {
        view.style.display = originalStyles.display;
        view.style.visibility = originalStyles.visibility;
        view.style.position = originalStyles.position;
        view.style.left = originalStyles.left;
        view.style.top = originalStyles.top;
      }

      return { width: tableWidth, height: viewHeight };
    };

    const updateContainerSize = () => {
      if (!containerRef.current) {
        return;
      }

      let maxWidth = 0;
      let maxHeight = 0;

      // Measure trackings view dimensions (always measure, even if empty)
      if (trackingsViewRef.current) {
        const { width, height } = measureView(trackingsViewRef.current);
        // For width, only use if we have a table or meaningful content
        if (width > 0) {
          maxWidth = Math.max(maxWidth, width);
        }
        // For height, always use the measurement (includes empty states)
        if (height > 0) {
          maxHeight = Math.max(maxHeight, height);
        }
      }

      // Measure reminders view dimensions (always measure, even if empty)
      if (remindersViewRef.current) {
        const { width, height } = measureView(remindersViewRef.current);
        // For width, only use if we have a table or meaningful content
        if (width > 0) {
          maxWidth = Math.max(maxWidth, width);
        }
        // For height, always use the measurement (includes empty states)
        if (height > 0) {
          maxHeight = Math.max(maxHeight, height);
        }
      }

      // If both views are empty, ensure we have a minimum height
      if (maxHeight === 0) {
        maxHeight = 200; // Minimum height for empty states
      }

      // Update width if we have a valid width
      if (maxWidth > 0) {
        // Add padding to account for container padding (40px on each side = 80px total)
        const containerPadding = 80;
        const newWidth = maxWidth + containerPadding;
        containerRef.current.style.width = `${newWidth}px`;
        containerRef.current.style.maxWidth = `${newWidth}px`;
      }

      // Update height if we have a valid height
      if (maxHeight > 0) {
        // Add padding to account for container padding and header
        // Header height + tabs header height + padding top (40px) + padding bottom (40px)
        // Include view margin-bottom (40px) for bottom spacing
        const headerHeight = containerRef.current.querySelector('header')?.getBoundingClientRect().height || 0;
        const tabsHeaderHeight = containerRef.current.querySelector('.tabs-header')?.getBoundingClientRect().height || 0;
        const containerPadding = 40 + 40; // top padding + bottom padding
        const viewMarginBottom = 40; // margin-bottom for bottom spacing
        const newHeight = maxHeight + headerHeight + tabsHeaderHeight + containerPadding + viewMarginBottom;
        containerRef.current.style.minHeight = `${newHeight}px`;
        containerRef.current.style.height = `${newHeight}px`;
      }
    };

    // Use requestAnimationFrame to ensure measurements happen after layout
    const scheduleUpdate = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Additional delay for empty states to fully render
          setTimeout(() => {
            updateContainerSize();
          }, 50);
        });
      });
    };

    // Initial measurement with a delay to ensure content (including empty states) is rendered
    const timeoutId = setTimeout(() => {
      scheduleUpdate();
    }, 200);

    // Use ResizeObserver to watch for size changes (if available)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleUpdate();
      });
    }

    if (resizeObserver) {
      // Observe the entire views to catch all changes including filters
      if (trackingsViewRef.current) {
        resizeObserver.observe(trackingsViewRef.current);
        // Also observe the list content container to catch filter panel changes
        const trackingsContent = trackingsViewRef.current.querySelector('.trackings-list-content');
        if (trackingsContent) {
          resizeObserver.observe(trackingsContent);
        }
        // Observe filter panel if it exists
        const trackingsFilterPanel = trackingsViewRef.current.querySelector('.filter-panel');
        if (trackingsFilterPanel) {
          resizeObserver.observe(trackingsFilterPanel);
        }
      }

      if (remindersViewRef.current) {
        resizeObserver.observe(remindersViewRef.current);
        // Also observe the list content container to catch filter panel changes
        const remindersContent = remindersViewRef.current.querySelector('.reminders-list-content');
        if (remindersContent) {
          resizeObserver.observe(remindersContent);
        }
        // Observe filter panel if it exists
        const remindersFilterPanel = remindersViewRef.current.querySelector('.filter-panel');
        if (remindersFilterPanel) {
          resizeObserver.observe(remindersFilterPanel);
        }
      }

      // Also observe the tabs-content container to catch any layout changes
      if (containerRef.current) {
        const tabsContent = containerRef.current.querySelector('.tabs-content');
        if (tabsContent) {
          resizeObserver.observe(tabsContent);
        }
      }
    }

    // Use MutationObserver to watch for filter panel additions/removals
    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        scheduleUpdate();
        // Re-observe filter panels if they were added
        if (resizeObserver) {
          if (trackingsViewRef.current) {
            const trackingsFilterPanel = trackingsViewRef.current.querySelector('.filter-panel');
            if (trackingsFilterPanel) {
              resizeObserver.observe(trackingsFilterPanel);
            }
          }
          if (remindersViewRef.current) {
            const remindersFilterPanel = remindersViewRef.current.querySelector('.filter-panel');
            if (remindersFilterPanel) {
              resizeObserver.observe(remindersFilterPanel);
            }
          }
        }
      });

      // Observe changes to the view containers
      if (trackingsViewRef.current) {
        mutationObserver.observe(trackingsViewRef.current, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      }
      if (remindersViewRef.current) {
        mutationObserver.observe(remindersViewRef.current, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      }
    }

    // Also update when window resizes
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [activeTab, trackings, trackingsLoading]);

  /**
   * Handle magic link verification from URL.
   * Checks URL for token and verifies it.
   * @internal
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for email change verification (works even when authenticated)
    const emailChangeVerified = urlParams.get('emailChangeVerified');
    if (emailChangeVerified === 'true') {
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Email change verification successful`);
      // Always normalize URL to app root after email change verification
      window.history.replaceState({}, document.title, '/');
      setMessage({
        text: 'Your email has been updated!',
        type: 'success',
      });
      // Refresh user data if authenticated
      if (isAuthenticated && user) {
        // User data will be refreshed on next render via useAuth hook
      }
      return;
    } else if (emailChangeVerified === 'false') {
      const errorMsg = urlParams.get('error');
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Email change verification failed:`, errorMsg);
      // Always normalize URL to app root after email change verification failure
      window.history.replaceState({}, document.title, '/');
      setMessage({
        text: errorMsg ? decodeURIComponent(errorMsg) : 'Email change verification failed',
        type: 'error',
      });
      return;
    }


    // Skip magic link verification if already authenticated or if verification was already attempted
    if (isAuthenticated || verificationAttempted.current) {
      return;
    }

    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Magic link token found in URL, attempting verification`);
      verificationAttempted.current = true;
      // Clean up URL immediately to prevent re-processing and normalize to app root
      window.history.replaceState({}, document.title, '/');

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
            text: err instanceof Error ? err.message : 'Error verifying link',
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
      window.history.replaceState({}, document.title, '/');
    }
  }, [verifyMagicLink, isAuthenticated]);

  /**
   * Handle login magic link request.
   * @param email - User's email
   * @returns Promise resolving to response data (includes message and optional cooldown flag)
   * @internal
   */
  const handleRequestLoginMagicLink = async (email: string): Promise<{ message: string; cooldown?: boolean }> => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link requested via form for email: ${email}`);
    try {
      const response = await requestLoginMagicLink(email);
      // Check if there's a cooldown - if so, show cooldown message instead of success
      if (response.cooldown) {
        console.log(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link request on cooldown, showing cooldown message`);
        setMessage({
          text: response.message,
          type: 'error',
        });
      } else {
        console.log(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link request successful, showing success message`);
        setMessage({
          text: response.message,
          type: 'success',
        });
      }
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Login magic link request failed:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error requesting login link',
        type: 'error',
      });
      throw error;
    }
  };

  /**
   * Handle cooldown message from resend.
   * @param message - Cooldown message
   * @internal
   */
  const handleCooldown = (message: string) => {
    setMessage({
      text: message,
      type: 'error',
    });
  };

  /**
   * Handle register magic link request.
   * @param name - User's name
   * @param email - User's email
   * @param profilePicture - Optional profile picture file
   * @internal
   */
  const handleRequestRegisterMagicLink = async (
    name: string,
    email: string,
    profilePicture?: File
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link requested via form for email: ${email}, name: ${name}`);
    try {
      await requestRegisterMagicLink(name, email, profilePicture);
      console.log(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link request successful, showing success message`);
      setMessage({
        text: 'Registration link sent! Check your email.',
        type: 'success',
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Registration magic link request failed:`, error);
      setMessage({
        text: error instanceof Error ? error.message : 'Error requesting registration link',
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
   * Handle change email.
   * @internal
   */
  const handleChangeEmail = () => {
    setShowChangeEmail(true);
  };

  /**
   * Handle request email change.
   * @param newEmail - New email address
   * @internal
   */
  const handleRequestEmailChange = async (newEmail: string) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Email change requested for: ${newEmail}`);
    try {
      await requestEmailChange(newEmail);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] FRONTEND_APP | Email change request failed:`, error);
      throw error;
    }
  };

  /**
   * Handle save profile.
   * @param name - Updated name
   * @param profilePicture - Updated profile picture file
   * @param removeProfilePicture - Whether to remove the profile picture
   * @internal
   */
  const handleSaveProfile = async (
    name: string,
    profilePicture: File | null,
    removeProfilePicture?: boolean
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Profile save initiated by user`);
    try {
      await updateProfile(name, profilePicture, removeProfilePicture);
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
   * @param question - Tracking question
   * @param type - Tracking type
   * @param notes - Optional notes
   * @param icon - Optional icon
   * @param schedules - Required schedules array
   * @param days - Optional days pattern
   * @internal
   */
  const handleCreateTracking = async (
    question: string,
    type: TrackingType,
    notes: string | undefined,
    icon: string | undefined,
    schedules: Array<{ hour: number; minutes: number }>,
    days: import("./models/Tracking").DaysPattern
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Creating tracking`);
    try {
      await createTracking(question, type, notes, icon, schedules, days);
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
    days: import("./models/Tracking").DaysPattern,
    question?: string,
    type?: TrackingType,
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>
  ) => {
    console.log(`[${new Date().toISOString()}] FRONTEND_APP | Updating tracking ID: ${trackingId}`);
    try {
      await updateTracking(trackingId, days, question, type, notes, icon, schedules);
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
            <img src="/assets/images/te-verde.png" alt="🌱" style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }} />
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
            onCooldown={handleCooldown}
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
    <div className="container" ref={containerRef}>
      <header className="app-header">
        <div>
          <h1>
            <img src="/assets/images/te-verde.png" alt="🌱" style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }} />
            Habitus
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
          <button
            type="button"
            className="fab"
            onClick={() => setShowTrackingForm(true)}
            aria-label="Add"
            title="Add"
          >
            +
          </button>
          {user && (
            <UserMenu
              user={user}
              onEditProfile={handleEditProfile}
              onChangeEmail={handleChangeEmail}
              onLogout={handleLogout}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </div>
      </header>

      <main>
        {message && (
          <Message
            text={message.text}
            type={message.type}
            onHide={handleHideMessage}
          />
        )}

        <div className="tabs-container">
          <div className="tabs-header">
            <button
              type="button"
              className={`tab-button ${activeTab === 'trackings' ? 'active' : ''}`}
              onClick={() => setActiveTab('trackings')}
            >
              Trackings
            </button>
            <button
              type="button"
              className={`tab-button ${activeTab === 'reminders' ? 'active' : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              Reminders
            </button>
          </div>
          <div className="tabs-content">
            <div
              className="trackings-view"
              ref={trackingsViewRef}
              style={{
                display: activeTab === 'trackings' ? 'block' : 'none',
              }}
            >
              <TrackingsList
                trackings={trackings}
                onEdit={handleEditTracking}
                onCreate={() => setShowTrackingForm(true)}
                isLoading={trackingsLoading}
                onStateChange={updateTrackingState}
                onDelete={deleteTracking}
                onStateChangeSuccess={(message) => {
                  setMessage({
                    text: message,
                    type: 'success',
                  });
                }}
              />
            </div>
            <div
              className="reminders-view"
              ref={remindersViewRef}
              style={{
                display: activeTab === 'reminders' ? 'block' : 'none',
              }}
            >
              <RemindersList
                onCreate={() => setShowTrackingForm(true)}
                onMessage={(text, type) => {
                  setMessage({
                    text,
                    type,
                  });
                }}
              />
            </div>
          </div>
        </div>
      </main>


      {showEditProfile && user && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSave={handleSaveProfile}
        />
      )}

      {showChangeEmail && user && (
        <ChangeEmailModal
          user={user}
          onClose={() => setShowChangeEmail(false)}
          onRequestEmailChange={handleRequestEmailChange}
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
              <h2>Create Tracking</h2>
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
        />
      )}
    </div>
  );
}

export default App;

