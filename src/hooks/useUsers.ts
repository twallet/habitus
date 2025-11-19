import { useState, useEffect } from 'react';
import { User, UserData } from '../models/User';

const STORAGE_KEY = 'habitus_users';

/**
 * Custom hook for managing users
 */
export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Load users from localStorage
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const loadedUsers = stored ? JSON.parse(stored) : [];
      setUsers(loadedUsers);

      // Initialize User model's nextId
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
   * Create a new user
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

