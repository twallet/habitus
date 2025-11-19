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

### Users

- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
  - Body: `{ "name": "string" }`
- `GET /api/users/:id` - Get a user by ID

### Health Check

- `GET /health` - Server health status

## Database

The database file is stored in `data/habitus.db`. The schema is automatically created on server startup.

## Environment Variables

- `PORT` - Server port (default: 3001)
