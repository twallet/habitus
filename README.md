# Habitus - Full Stack Application

Full-stack web application with separated frontend and backend for creating and managing users in Habitus.

## Architecture

The application is split into two separate projects:

- **Frontend** - React application built with TypeScript and Vite
- **Backend** - Node.js/Express API server with SQLite database

## Features

- Modern and responsive interface
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
- **SQLite** (better-sqlite3) - Database
- **TypeScript** - Type safety

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

1. **Frontend**: Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=http://localhost:3001
```

2. **Backend**: Create a `.env` file in the `backend` directory:

```env
PORT=3001
NODE_ENV=development
DB_PATH=./data/habitus.db

# SMTP Configuration (Required for magic link emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Note**: For Gmail, you'll need to generate an App Password. See the [Backend README](backend/README.md) for detailed SMTP setup instructions.

### Development

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

### Build

Build for production:

```bash
npm run build
```

The production build will be in the `dist` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
habitus/
├── backend/                    # Backend API server
│   ├── src/
│   │   ├── db/                # Database configuration
│   │   │   └── database.ts    # SQLite setup and migrations
│   │   ├── models/            # Data models
│   │   │   └── User.ts        # User model
│   │   ├── routes/            # API routes
│   │   │   └── users.ts       # User endpoints
│   │   ├── services/          # Business logic
│   │   │   └── userService.ts # User service
│   │   └── server.ts          # Express server
│   ├── data/                  # SQLite database (gitignored)
│   ├── package.json           # Backend dependencies
│   ├── tsconfig.json          # TypeScript config
│   └── README.md              # Backend documentation
├── frontend/                   # Frontend React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── __tests__/     # Component tests
│   │   │   ├── UserForm.tsx   # Form for creating users
│   │   │   ├── Message.tsx    # Success/error messages
│   │   │   └── UsersList.tsx  # List of created users
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── __tests__/     # Hook tests
│   │   │   └── useUsers.ts    # User management hook
│   │   ├── models/            # Data models
│   │   │   ├── __tests__/     # Model tests
│   │   │   └── User.ts        # User model class
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

1. Start both servers: `npm run dev` (or run them separately)
2. Open the application in your browser at `http://localhost:3000`
3. Enter a user name (maximum 30 characters)
4. Click "Create User"
5. The user will be saved in the database and appear in the list of created users

Users are persisted in the SQLite database located at `backend/data/habitus.db`.

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
- **useUsers Hook** - User creation, API communication, and error handling
- **React Components** - UserForm, Message, UsersList, and App integration
- **Backend API** - User endpoints and database operations

## Scripts

### Root Scripts (Workspace)

- `npm run dev` - Start both frontend and backend servers
- `npm run dev:frontend` - Start frontend development server only
- `npm run dev:backend` - Start backend development server only
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

- **All comments must be in English and use TSDoc format**
  - Use TSDoc comments for functions, classes, and complex logic
  - TSDoc is the recommended standard for TypeScript projects (by Microsoft)
  - Mark public APIs with `@public`, internal implementations with `@internal`
  - Use `@throws` with `{@link ErrorType}` for error documentation
  - Example:
    ```typescript
    /**
     * Creates a new user with the given name.
     * @param name - The user's name (max 30 characters)
     * @returns The created User instance
     * @throws {@link TypeError} If the name is invalid
     * @public
     */
    ```

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
  - Aim for high coverage (ideally >80%) while ensuring tests are meaningful
  - Focus on testing critical business logic, edge cases, and error handling

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
  - Prevent XSS attacks (use `escapeHtml` for user-generated content)
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
