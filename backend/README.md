# Habitus Backend

Backend API server for Habitus application built with Node.js, Express, and SQLite.

## Features

- RESTful API for user management
- SQLite database for data persistence
- TypeScript for type safety
- CORS enabled for frontend communication

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **SQLite** (better-sqlite3) - Database
- **TypeScript** - Type safety

## Getting Started

### Prerequisites

- Node.js 18+ and npm

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

The server will be available at `http://localhost:3001`.

### Build

Build for production:

```bash
npm run build
```

### Production

Run the production server:

```bash
npm start
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

### Health Check

- `GET /health` - Server health status

## Database

The database file is stored in `data/habitus.db`. The schema is automatically created on server startup.

## Testing

Run tests:

```bash
npm test
```

**Note**: Some tests require `better-sqlite3` to be compiled, which requires Visual Studio Build Tools on Windows. If you encounter compilation errors, you can still run tests that don't require the database:

```bash
npm test -- src/models/__tests__/User.test.ts
```

### Test Coverage

The project includes tests for:

- **User Model** - Name validation and rules
- **UserService** - Database operations (requires better-sqlite3)
- **API Routes** - Endpoint testing (requires better-sqlite3)

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

### Server Configuration

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `BASE_URL` - Base URL for the server (default: http://localhost:3001)

### Database Configuration

- `DB_PATH` - Database file path (default: ./data/habitus.db)

### JWT Configuration

- `JWT_SECRET` - Secret key for JWT tokens (default: your-secret-key-change-in-production)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 7d)

### Magic Link Configuration

- `MAGIC_LINK_EXPIRY_MINUTES` - Magic link expiration time in minutes (default: 15)

### Frontend Configuration

- `FRONTEND_URL` - Frontend URL for OAuth redirects and email links (default: http://localhost:3000)

### SMTP Configuration (Required for email functionality)

- `SMTP_HOST` - SMTP server hostname (default: smtp.gmail.com)
- `SMTP_PORT` - SMTP server port (default: 587)
- `SMTP_USER` - SMTP username/email address (**required**)
- `SMTP_PASS` - SMTP password/app password (**required**)

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

### Example .env File

Create a `.env` file in the `backend` directory with the following structure:

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
