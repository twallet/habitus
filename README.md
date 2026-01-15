# Habitus

Habitus is a modern, full-stack habit tracking application designed for simplicity and effectiveness. It features automated reminders, Telegram integration, and a sleek React-based dashboard.

## 🚀 Features

- **Habit Tracking**: Define and manage your habits with customizable frequencies.
- **Smart Reminders**: Automated polling system that keeps your habits on track.
- **Telegram Integration**: Receive instant notifications and respond to reminders directly from Telegram.
- **Secure Auth**: Passwordless login via Magic Links and email verification.
- **Flexible Storage**: Supports local filesystem or Cloudinary for profile pictures and uploads.
- **Admin Dashboard**: Comprehensive tools for user management and system health.

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript**
- **Vite** (Next-generation frontend tooling)
- **Vanilla CSS** (Custom, premium styling)

### Backend
- **Node.js** + **Express.js** + **TypeScript**
- **SQLite** (Development) / **PostgreSQL** (Production)
- **Telegram Bot API**
- **Vitest** (Unified testing framework)

### Shared
- **@habitus/shared**: Common types and utilities shared across the monorepo.

## 📂 Project Structure

```text
habitus/
├── frontend/          # React + Vite application
├── backend/           # Express server + implementation logic
├── packages/
│   └── shared/        # Shared code and types
├── config/            # Shared configuration and test scripts
└── docs/              # Project documentation
```

## ⚙️ Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/habitus.git
   cd habitus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Create a `.env` file in `config/` based on the provided examples.

### Development

Run backend and frontend (Vite HMR) simultaneously:
```bash
npm run dev
```

### Build

Build all packages for production:
```bash
npm run build
```

### Testing

Run the full test suite with coverage:
```bash
npm test
```

## ☁️ Deployment

Habitus is ready for deployment on **Railway** via the included `railway.json` and `railway.toml`. Ensure all production environment variables (including `DATABASE_URL` for PostgreSQL) are configured in your deployment platform.

---

Built with ❤️ by the Habitus Team.
