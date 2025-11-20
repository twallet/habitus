import { useState } from 'react';
import { UserForm } from './components/UserForm';
import { Message } from './components/Message';
import { UsersList } from './components/UsersList';
import { AuthForm } from './components/AuthForm';
import { useUsers } from './hooks/useUsers';
import { useAuth } from './hooks/useAuth';
import './App.css';

/**
 * Main application component.
 * Shows login/register screen first, then main app after authentication.
 * @public
 */
function App() {
  const { user, isLoading, isAuthenticated, login, register, logout } = useAuth();
  const { users, createUser, isInitialized } = useUsers();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
   * Handle user creation from form submission.
   * Displays success message with user details or error message if creation fails.
   * @param name - The user's name to create
   * @internal
   */
  const handleUserCreate = async (name: string) => {
    try {
      const newUser = await createUser(name);
      setMessage({
        text: `User "${newUser.name}" created successfully with ID: ${newUser.id}`,
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error creating user',
        type: 'error',
      });
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
            onLogin={handleLogin}
            onRegister={handleRegister}
            onError={handleError}
          />
        </main>
      </div>
    );
  }

  // Show main app if authenticated
  if (!isInitialized) {
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
        <p className="subtitle">Create your user to get started</p>
      </header>

      <main>
        <div className="user-info-header">
          <div className="welcome-message">
            Welcome, {user?.name}!
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>

        <UserForm onSubmit={handleUserCreate} onError={handleError} />

        {message && (
          <Message
            text={message.text}
            type={message.type}
            onHide={handleHideMessage}
          />
        )}

        <UsersList users={users} />
      </main>
    </div>
  );
}

export default App;

