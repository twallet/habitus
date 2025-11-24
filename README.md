# Habitus - Full Stack Application

Full-stack web application with separated frontend and backend for creating and managing users in Habitus.

## Architecture

The application is split into two separate projects:

- **Frontend** - React application built with TypeScript and Vite
- **Backend** - Node.js/Express API server with SQLite database

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

Alternatively, you can install them separately:

```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### Environment Variables

#### Frontend

Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=http://localhost:3001
```

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

# Frontend URL
FRONTEND_URL=http://localhost:3000

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

You can run both frontend and backend together:

```bash
npm run dev
```

Or run them separately in different terminals:

1. **Backend server**:

```bash
npm run dev:backend
# or
cd backend && npm run dev
```

The backend API will be available at `http://localhost:3001`.

2. **Frontend development server**:

```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

The frontend application will be available at `http://localhost:3000`.

### Server Management

You can manage the backend server using utility scripts:

**Kill the server:**

```bash
npm run dev:kill
```

This will stop the backend server running on port 3001.

**Restart the server:**

```bash
npm run dev:restart
```

This will kill the existing server and start it again in the same terminal. The server will run in the foreground, and you can stop it with `Ctrl+C`.

**Note**: The server uses `tsx watch` for development, which automatically reloads on file changes. You typically only need to restart manually if the auto-reload isn't working or if you need a clean restart.

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
├── scripts/                    # Development utility scripts
│   ├── kill-server.ps1        # Script to kill the backend server
│   └── restart-server.ps1     # Script to restart the backend server
├── package.json                # Root workspace configuration
└── README.md                   # This file
```

## Usage

1. Start both servers: `npm run dev` (or run them separately)
2. Open the application in your browser at `http://localhost:3000`
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

- `npm run dev` - Start both frontend and backend servers
- `npm run dev:frontend` - Start frontend development server only
- `npm run dev:backend` - Start backend development server only
- `npm run dev:kill` - Kill the backend server running on port 3001
- `npm run dev:restart` - Restart the backend server (kills and starts in same terminal)
- `npm run build` - Build both frontend and backend for production
- `npm run build:frontend` - Build frontend for production
- `npm run build:backend` - Build backend for production
- `npm test` - Run all tests (frontend and backend)
- `npm run test:frontend` - Run frontend tests only
- `npm run test:backend` - Run backend tests only
- `npm run test:coverage` - Run all tests with coverage report
- `npm run lint` - Run ESLint on frontend

### Frontend Scripts (in `frontend/` directory)

- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run frontend tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Backend Scripts (in `backend/` directory)

- `npm run dev` - Start backend development server
- `npm run build` - Build backend for production
- `npm start` - Run production server
- `npm test` - Run backend tests

## Code Standards

This project follows strict coding standards to ensure code quality and maintainability:

### Comments

- **All comments must be in English and use JSDoc/TSDoc format**
  - Use JSDoc/TSDoc comments for functions, classes, and complex logic
  - Mark public APIs appropriately
  - Document parameters, return values, and exceptions

### Code Language

- **All code must be in English, including error messages**
  - Variable names, function names, and all identifiers must be in English
  - Error messages and user-facing text must be in English
  - Console logs and debug messages must be in English

### Testing

- **Add or adjust relevant test cases after making code changes**

  - When adding new features, add corresponding test cases
  - When modifying existing code, update tests to reflect changes
  - Ensure tests cover edge cases and error scenarios

- **Run all test suites after making code changes**

  - Always run `npm test` before committing code
  - Ensure all tests pass before submitting changes
  - Use `npm run test:coverage` to verify test coverage

- **Verify test coverage after each code change and add tests as needed**
  - After making code changes, run `npm run test:coverage` to check coverage
  - Review the coverage report to identify untested code paths
  - Add tests for any new or modified code that lacks adequate coverage
  - Aim for high coverage (ideally >75%) while ensuring tests are meaningful

### Code Quality

- **Check for dead/duplicated code after making code changes**
  - Remove unused imports, functions, and variables
  - Refactor duplicated code into reusable functions/components
  - Use ESLint to identify unused code: `npm run lint`

### Naming Conventions

- **Use descriptive names in English following consistent conventions**
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_NAME_LENGTH`, `STORAGE_KEY`)
  - Components: `PascalCase` (e.g., `UserForm`, `Message`)
  - Functions/Variables: `camelCase` (e.g., `createUser`, `handleSubmit`)
  - Files: `camelCase` for components, `kebab-case` for utilities
  - Avoid abbreviations unless widely understood
  - Names should clearly indicate purpose and intent

### Code Structure

- **Write clean, maintainable code following best practices**
  - Functions should be small and have a single responsibility
  - Avoid functions longer than ~50 lines (consider breaking them down)
  - Maximum 3-4 parameters per function (use objects for more parameters)
  - Avoid deep nesting (maximum 3 levels)
  - Extract complex logic into separate functions or custom hooks
  - Keep components focused and composable

### TypeScript Standards

- **Follow TypeScript best practices for type safety**
  - Avoid `any` type; use `unknown` if type is truly unknown
  - Provide explicit return types for public functions
  - Use `interface` for object shapes, `type` for unions/primitives
  - Never use `@ts-ignore` without a justified comment explaining why
  - Leverage TypeScript's type system to catch errors at compile time
  - Use type guards and assertions appropriately

### React Best Practices

- **Follow React conventions and patterns**
  - Use functional components with hooks (avoid class components)
  - Use `useCallback` and `useMemo` when appropriate to prevent unnecessary re-renders
  - Provide unique and stable keys for list items
  - Separate business logic from presentation (use custom hooks)
  - Keep components small and focused on a single responsibility
  - Use proper prop types/interfaces for all components

### Error Handling

- **Implement comprehensive error handling**
  - Handle all possible error scenarios
  - Provide descriptive error messages that help users understand the issue
  - Use Error Boundaries in React for component-level error handling
  - Log errors appropriately for debugging (use `console.error` for errors)
  - Never silently swallow errors unless explicitly intended
  - Validate inputs and handle edge cases gracefully

### Performance

- **Optimize code for performance**
  - Avoid unnecessary re-renders (use React DevTools Profiler)
  - Implement lazy loading for large components or routes
  - Optimize images and assets (use appropriate formats and sizes)
  - Review bundle size periodically (`npm run build` and check output)
  - Use code splitting when appropriate
  - Profile performance-critical code paths

### Security

- **Follow security best practices**
  - Validate and sanitize all user inputs
  - Prevent XSS attacks (use proper escaping for user-generated content)
  - Never expose secrets, API keys, or sensitive data in code
  - Use HTTPS in production environments
  - Keep dependencies updated to avoid known vulnerabilities
  - Review security advisories regularly (`npm audit`)

### Accessibility

- **Ensure application is accessible to all users**
  - Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
  - Add ARIA attributes when semantic HTML is insufficient
  - Ensure keyboard navigation works for all interactive elements
  - Maintain proper color contrast ratios (WCAG AA minimum)
  - Provide alternative text for images (`alt` attribute)
  - Test with screen readers when possible

### Dependencies

- **Manage dependencies responsibly**
  - Keep dependencies updated to latest stable versions
  - Regularly check for vulnerabilities: `npm audit`
  - Avoid unnecessary dependencies (prefer native solutions when possible)
  - Document critical dependencies and their purpose
  - Review and remove unused dependencies periodically
  - Use exact versions (`package-lock.json`) for reproducible builds

## License

MIT
