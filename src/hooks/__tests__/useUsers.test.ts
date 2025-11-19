import { renderHook, act, waitFor } from '@testing-library/react';
import { useUsers } from '../useUsers';
import { User } from '../../models/User';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useUsers', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    // Reset User's static nextId counter before each test
    User.initializeNextId(0);
  });

  it('should initialize with empty users array', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual([]);
  });

  it('should load users from localStorage on mount', async () => {
    const storedUsers = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
    ];
    localStorage.setItem('habitus_users', JSON.stringify(storedUsers));

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual(storedUsers);
  });

  it('should create a new user', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    act(() => {
      const newUser = result.current.createUser('New User');
      expect(newUser.name).toBe('New User');
      expect(newUser.id).toBe(1);
    });

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].name).toBe('New User');
    expect(result.current.users[0].id).toBe(1);
  });

  it('should save users to localStorage when creating', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    act(() => {
      result.current.createUser('Test User');
    });

    const stored = localStorage.getItem('habitus_users');
    expect(stored).not.toBeNull();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Test User');
    }
  });

  it('should handle multiple users', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    act(() => {
      result.current.createUser('User 1');
    });

    act(() => {
      result.current.createUser('User 2');
    });

    act(() => {
      result.current.createUser('User 3');
    });

    expect(result.current.users).toHaveLength(3);
    expect(result.current.users[0].name).toBe('User 1');
    expect(result.current.users[1].name).toBe('User 2');
    expect(result.current.users[2].name).toBe('User 3');
  });

  it('should initialize User model nextId from existing users', async () => {
    const storedUsers = [
      { id: 5, name: 'User 5' },
      { id: 10, name: 'User 10' },
    ];
    localStorage.setItem('habitus_users', JSON.stringify(storedUsers));

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    act(() => {
      const newUser = result.current.createUser('New User');
      expect(newUser.id).toBe(11); // Should continue from max ID (10)
    });
  });

  it('should handle localStorage errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock localStorage.getItem to throw an error
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = jest.fn(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual([]);

    // Restore
    localStorage.getItem = originalGetItem;
    consoleSpy.mockRestore();
  });

  it('should throw error when saving fails', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // Suppress console.error for this test since we're testing error handling
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock localStorage.setItem to throw an error
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error('Storage quota exceeded');
    });

    act(() => {
      expect(() => {
        result.current.createUser('Test User');
      }).toThrow('Error saving user');
    });

    // Restore
    localStorage.setItem = originalSetItem;
    console.error = originalConsoleError;
  });
});

