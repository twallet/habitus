import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from './db/database.js';
import usersRouter from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Middleware configuration.
 */
app.use(cors());
app.use(express.json());

/**
 * API routes.
 */
app.use('/api/users', usersRouter);

/**
 * Health check endpoint.
 */
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

/**
 * Initialize database and start server.
 */
initializeDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    /**
     * Graceful shutdown.
     */
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        closeDatabase().catch(console.error);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        closeDatabase().catch(console.error);
      });
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });


