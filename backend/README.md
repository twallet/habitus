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

- `POST /api/auth/register` - Register a new user
  - Body: `{ "name": "string", "email": "string", "password": "string" }`
- `POST /api/auth/login` - Login with email and password
  - Body: `{ "email": "string", "password": "string" }`
- `GET /api/auth/google` - Initiate Google OAuth flow (redirects to Google)
- `GET /api/auth/google/callback` - Google OAuth callback handler
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

- `PORT` - Server port (default: 3001)
- `DB_PATH` - Database file path (default: ./data/habitus.db)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - Secret key for JWT tokens (default: your-secret-key-change-in-production)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 7d)
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 Client ID (required for Google login)
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 Client Secret (required for Google login)
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI (default: http://localhost:3001/api/auth/google/callback)
- `FRONTEND_URL` - Frontend URL for OAuth redirects (default: http://localhost:3000)

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback` (for development)
   - Your production callback URL (for production)
7. Copy the Client ID and Client Secret
8. Add them to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```
