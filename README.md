# Habitus - Web Application

Modern web application built with React, TypeScript, and Vite for creating and managing users in Habitus.

## Features

- Modern and responsive interface
- User name validation (maximum 30 characters)
- User persistence in localStorage
- List of created users
- Success and error messages
- TypeScript for type safety
- React hooks for state management

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Jest** - Testing framework
- **React Testing Library** - Component testing utilities
- **ESLint** - Code linting

## Getting Started

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)

### Installation

1. Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

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
├── src/
│   ├── components/              # React components
│   │   ├── __tests__/          # Component tests
│   │   ├── UserForm.tsx        # Form for creating users
│   │   ├── Message.tsx         # Success/error messages
│   │   └── UsersList.tsx       # List of created users
│   ├── hooks/                   # Custom React hooks
│   │   ├── __tests__/          # Hook tests
│   │   └── useUsers.ts         # User management hook
│   ├── models/                  # Data models
│   │   ├── __tests__/          # Model tests
│   │   └── User.ts             # User model class
│   ├── __tests__/              # App tests
│   ├── App.tsx                 # Main application component
│   ├── App.css                 # Application styles
│   ├── main.tsx                # Application entry point
│   └── setupTests.ts           # Jest setup
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.js              # Jest configuration
├── vite.config.ts              # Vite configuration
└── README.md                   # This file
```

## Usage

1. Start the development server with `npm run dev`
2. Open the application in your browser
3. Enter a user name (maximum 30 characters)
4. Click "Create User"
5. The user will be saved and appear in the list of created users

Users are saved in the browser's localStorage and persist between sessions.

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

- **User Model** - Validation, ID generation, and initialization
- **useUsers Hook** - User creation, localStorage persistence, and error handling
- **React Components** - UserForm, Message, UsersList, and App integration

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## License

MIT
