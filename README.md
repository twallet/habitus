# Habitus - Full Stack Application

Full-stack web application with separated frontend and backend for creating and managing users in Habitus.

## Architecture

The application uses a unified server architecture where the backend serves both the API and the frontend:

- **Backend** - Node.js/Express API server with SQLite database that also serves the frontend
  - In development: Uses Vite middleware to serve the React frontend with Hot Module Replacement (HMR)
  - In production: Serves static files from the frontend build
- **Frontend** - React application built with TypeScript and Vite (served by the backend)

## Features

- Modern and responsive interface
- Passwordless authentication with magic links
- User management with profile pictures
- User name validation (maximum 30 characters)
- RESTful API for user management
- SQLite database for data persistence
- List of created users
- Success and error messages
- TypeScript for type safety
- React hooks for state management

## Tech Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Jest** - Testing framework
- **React Testing Library** - Component testing utilities
- **ESLint** - Code linting

### Backend

- **Node.js** - Runtime environment
- **Express** - Web framework
- **SQLite** (sqlite3) - Database
- **TypeScript** - Type safety
- **JWT** - Authentication tokens
- **Nodemailer** - Email service for magic links

## Getting Started

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)

### Installation

Install all dependencies (frontend and backend) using npm workspaces:

```bash
npm install
```

This will install dependencies for both frontend and backend projects.

````

### Environment Variables

#### Frontend

Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=http://localhost:3001
````

#### Backend

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001

# Database Configuration
DB_PATH=./data/habitus.db

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Magic Link Configuration
MAGIC_LINK_EXPIRY_MINUTES=15

# Frontend URL (used for email links)
FRONTEND_URL=http://localhost:3001

# SMTP Configuration (Required for email functionality)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Setting Up SMTP (Required for Magic Link Emails)

The application requires SMTP configuration to send magic link emails for passwordless authentication. Here's how to set it up:

#### For Gmail:

1. Enable 2-Step Verification on your Google Account
2. Generate an App Password:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the generated password (16 characters)
3. Add the following to your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

#### For Other SMTP Providers:

Update the SMTP configuration in your `.env` file according to your provider's settings:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
```

**Note**: For Gmail and many other providers, you may need to use an app-specific password rather than your regular account password.

## Development

Start the unified development server (backend serves both API and frontend):

```bash
npm run dev
```

This starts a single server on `http://localhost:3001` that:

- Serves the backend API at `/api/*` endpoints
- Serves the React frontend with Vite HMR (Hot Module Replacement) for all other routes
- Automatically reloads on file changes using `tsx watch`

The application will be available at `http://localhost:3001`.

## Build

Build for production:

```bash
npm run build
```

This will build both frontend and backend. The production builds will be in their respective `dist` directories.

### Production

Run the production server:

```bash
cd backend && npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Request registration magic link (passwordless)
  - Body: `{ "name": "string", "email": "string", "nickname": "string" (optional), "profilePicture": File (optional) }`
- `POST /api/auth/login` - Request login magic link (passwordless)
  - Body: `{ "email": "string" }`
- `GET /api/auth/verify-magic-link` - Verify magic link token and log user in
  - Query: `?token=string`
- `GET /api/auth/me` - Get current user information
  - Header: `Authorization: Bearer <token>`

### Users

- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
  - Body: `{ "name": "string" }`
- `GET /api/users/:id` - Get a user by ID

### Trackings

- `GET /api/trackings` - Get all trackings (requires authentication)
- `POST /api/trackings` - Create a new tracking (requires authentication)
- `GET /api/trackings/:id` - Get a tracking by ID (requires authentication)
- `PUT /api/trackings/:id` - Update a tracking (requires authentication)
- `DELETE /api/trackings/:id` - Delete a tracking (requires authentication)

### Health Check

- `GET /health` - Server health status

## Database

The database file is stored in `backend/data/habitus.db`. The schema is automatically created on server startup.

## Project Structure

```
habitus/
├── backend/                    # Backend API server
│   ├── src/
│   │   ├── db/                # Database configuration
│   │   │   └── database.ts    # SQLite setup and migrations
│   │   ├── models/            # Data models
│   │   │   ├── User.ts        # User model
│   │   │   └── Tracking.ts    # Tracking model
│   │   ├── routes/            # API routes
│   │   │   ├── auth.ts        # Authentication endpoints
│   │   │   ├── users.ts       # User endpoints
│   │   │   └── trackings.ts   # Tracking endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── authService.ts # Authentication service
│   │   │   ├── userService.ts # User service
│   │   │   ├── trackingService.ts # Tracking service
│   │   │   └── emailService.ts # Email service
│   │   ├── middleware/        # Express middleware
│   │   │   ├── authMiddleware.ts # JWT authentication
│   │   │   ├── rateLimiter.ts # Rate limiting
│   │   │   └── upload.ts      # File upload handling
│   │   └── server.ts          # Express server
│   ├── data/                  # SQLite database (gitignored)
│   ├── package.json           # Backend dependencies
│   ├── tsconfig.json          # TypeScript config
│   └── jest.config.cjs        # Jest configuration
├── frontend/                   # Frontend React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── __tests__/     # Component tests
│   │   │   ├── AuthForm.tsx   # Authentication form
│   │   │   ├── UserForm.tsx   # Form for creating users
│   │   │   ├── Message.tsx    # Success/error messages
│   │   │   ├── UsersList.tsx  # List of created users
│   │   │   └── ...            # Other components
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── __tests__/     # Hook tests
│   │   │   ├── useAuth.ts     # Authentication hook
│   │   │   ├── useUsers.ts    # User management hook
│   │   │   └── useTrackings.ts # Tracking management hook
│   │   ├── models/            # Data models
│   │   │   ├── __tests__/     # Model tests
│   │   │   ├── User.ts        # User model class
│   │   │   └── Tracking.ts    # Tracking model class
│   │   ├── config/            # Configuration
│   │   │   └── api.ts         # API configuration
│   │   ├── __tests__/         # App tests
│   │   ├── App.tsx            # Main application component
│   │   ├── App.css            # Application styles
│   │   ├── main.tsx           # Application entry point
│   │   └── setupTests.ts      # Jest setup
│   ├── index.html             # HTML template
│   ├── package.json           # Frontend dependencies
│   ├── tsconfig.json          # TypeScript configuration
│   ├── jest.config.cjs        # Jest configuration
│   └── vite.config.ts         # Vite configuration
├── package.json                # Root workspace configuration
└── README.md                   # This file
```

## Usage

1. Start the unified server: `npm run dev`
2. Open the application in your browser at `http://localhost:3001`
3. Register or login using the magic link authentication
4. Create and manage users and trackings
5. All data is persisted in the SQLite database located at `backend/data/habitus.db`

## Testing

The project includes comprehensive tests using Jest and React Testing Library.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Tests cover:

- **User Model** - Validation and name rules
- **Tracking Model** - Validation and business logic
- **useUsers Hook** - User creation, API communication, and error handling
- **useAuth Hook** - Authentication flow and token management
- **useTrackings Hook** - Tracking CRUD operations
- **React Components** - UserForm, Message, UsersList, AuthForm, and App integration
- **Backend API** - User endpoints, authentication, and database operations
- **Middleware** - Authentication, rate limiting, and file upload handling

**Note**: Some backend tests require `sqlite3` to be compiled, which requires Visual Studio Build Tools on Windows. If you encounter compilation errors, you can still run tests that don't require the database:

```bash
npm test -- src/models/__tests__/User.test.ts
```

## Scripts

### Root Scripts (Workspace)

- `npm run dev` - Start unified development server (backend serves both API and frontend)
- `npm run build` - Build both frontend and backend for production
- `npm test` - Run all tests (frontend and backend)
- `npm run test:frontend` - Run frontend tests only
- `npm run test:backend` - Run backend tests only
- `npm run test:coverage` - Run all tests with coverage report
- `npm run lint` - Run ESLint on frontend

### Frontend Scripts (in `frontend/` directory)

- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run frontend tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

**Note**: The `dev` script is not used directly. The frontend is served by the unified backend server via Vite middleware in development mode.

### Backend Scripts (in `backend/` directory)

- `npm run dev` - Start backend development server
- `npm run build` - Build backend for production
- `npm start` - Run production server
- `npm test` - Run backend tests

## License

MIT
