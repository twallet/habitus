import { useState, useEffect } from 'react';
import { User, UserData } from '../models/User';

const STORAGE_KEY = 'habitus_users';

/**
 * Custom hook for managing users
 * @returns Object containing users array, createUser function, and initialization status
 */
export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Load users from localStorage on component mount
   * Initializes User model's nextId based on existing users
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const loadedUsers = stored ? JSON.parse(stored) : [];
      setUsers(loadedUsers);

      /**
       * Initialize User model's nextId to prevent ID conflicts
       */
      if (loadedUsers.length > 0) {
        const maxId = Math.max(...loadedUsers.map((user: UserData) => user.id));
        User.initializeNextId(maxId);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
      setIsInitialized(true);
    }
  }, []);

  /**
   * Save users to localStorage
   * @param usersToSave - Array of user data to save
   * @throws {Error} If saving to localStorage fails
   */
  const saveUsers = (usersToSave: UserData[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usersToSave));
      setUsers(usersToSave);
    } catch (error) {
      console.error('Error saving users:', error);
      throw new Error('Error saving user');
    }
  };

  /**
   * Create a new user and save it to localStorage
   * @param name - The user's name (max 30 characters)
   * @returns The created user data
   * @throws {TypeError} If the name is invalid
   * @throws {Error} If saving to localStorage fails
   */
  const createUser = (name: string): UserData => {
    const user = new User(name);
    const userData: UserData = {
      id: user.id,
      name: user.name,
    };

    const updatedUsers = [...users, userData];
    saveUsers(updatedUsers);
    return userData;
  };

  return {
    users,
    createUser,
    isInitialized,
  };
}

