import { useState } from 'react';
import { UserForm } from './components/UserForm';
import { Message } from './components/Message';
import { UsersList } from './components/UsersList';
import { useUsers } from './hooks/useUsers';
import './App.css';

/**
 * Main application component
 */
function App() {
  const { users, createUser, isInitialized } = useUsers();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleUserCreate = (name: string) => {
    try {
      const user = createUser(name);
      setMessage({
        text: `User "${user.name}" created successfully with ID: ${user.id}`,
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Error creating user',
        type: 'error',
      });
    }
  };

  const handleError = (errorMessage: string) => {
    setMessage({
      text: errorMessage,
      type: 'error',
    });
  };

  const handleHideMessage = () => {
    setMessage(null);
  };

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

