import { useState, FormEvent } from 'react';
import { User } from '../models/User';

interface UserFormProps {
  onSubmit: (name: string) => void;
  onError: (message: string) => void;
}

/**
 * Form component for creating a new user
 * @param props - Component props
 * @param props.onSubmit - Callback function called when form is submitted with valid name
 * @param props.onError - Callback function called when validation fails or error occurs
 */
export function UserForm({ onSubmit, onError }: UserFormProps) {
  const [name, setName] = useState('');
  const [charCount, setCharCount] = useState(0);

  /**
   * Handle form submission
   * Validates the user name and calls onSubmit if valid
   * @param e - Form submission event
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      onError('User name must not be empty');
      return;
    }

    try {
      /**
       * Validate using User model constructor
       */
      new User(trimmedName);
      onSubmit(trimmedName);
      setName('');
      setCharCount(0);
    } catch (error) {
      if (error instanceof TypeError) {
        onError(error.message);
      } else {
        onError('Error creating user');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setCharCount(value.length);
  };

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <div className="form-group">
        <label htmlFor="userName">User Name</label>
        <input
          type="text"
          id="userName"
          name="userName"
          placeholder="Enter your name"
          maxLength={User.MAX_NAME_LENGTH}
          value={name}
          onChange={handleInputChange}
          required
          autoComplete="off"
        />
        <span className="char-count">
          <span id="charCount">{charCount}</span>/{User.MAX_NAME_LENGTH} characters
        </span>
      </div>

      <button type="submit" className="btn-primary">
        Create User
      </button>
    </form>
  );
}

