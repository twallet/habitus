import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService.js';

const router = Router();

/**
 * GET /api/users
 * Get all users.
 * @route GET /api/users
 * @returns {UserData[]} Array of users
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const users = UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

/**
 * POST /api/users
 * Create a new user.
 * @route POST /api/users
 * @body {string} name - The user's name
 * @returns {UserData} The created user
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required and must be a string' });
    }

    const user = UserService.createUser(name);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

/**
 * GET /api/users/:id
 * Get a user by ID.
 * @route GET /api/users/:id
 * @param {number} id - The user ID
 * @returns {UserData} The user data
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = UserService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

export default router;

