# coding-platform-baku

A full-stack coding practice platform: browse and solve problems, run code against test cases, and track progress. The UI is a React app with an in-browser editor; the API stores problems, submissions, and user statistics in PostgreSQL and executes Python and C++ in isolated Docker containers.

## Features

- **Accounts** — Register, log in, and JWT-based sessions with refresh tokens.
- **Problems** — Create problems (authenticated), view listings and details, difficulty and tags.
- **Submissions** — Submit solutions; results are checked against public and hidden test cases.
- **Execution** — Python and C++ run inside Docker sandboxes with resource limits.
- **Stats** — Per-user and per-problem submission metrics and progress tracking.

## Tech stack

| Area | Technologies |
|------|----------------|
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS 4, Zustand, Monaco Editor, Axios |
| Backend | Node.js (ES modules), Express 5, Prisma 5, PostgreSQL |
| Auth | bcryptjs, jsonwebtoken |

## Prerequisites

- **Node.js** (current LTS recommended)
- **PostgreSQL** database
- **Docker Desktop** (or Docker Engine) — required for judging Python and C++ submissions

## Repository layout

```
├── frontend/     # Vite + React SPA
├── backend/      # Express API, Prisma schema, Docker sandbox images
```

## Backend setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` file in `backend/` with at least:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL connection string (Prisma format) |
   | `JWT_SECRET` | Secret used to sign access and refresh tokens |
   | `PORT` | API port (optional; default is `3000`) |

3. Apply the database schema:

   ```bash
   npx prisma migrate deploy
   ```

   During development you can use `npx prisma migrate dev` instead.

4. Build the sandbox images (image names must match what the executor expects):

   ```bash
   docker build -f docker/Dockerfile.python -t python-sandbox .
   docker build -f docker/Dockerfile.cpp -t cpp-sandbox .
   ```

5. Start the API from `backend/`:

   ```bash
   node src/server.js
   ```

The API allows CORS from `http://localhost:5173` (the default Vite dev URL).

### API base path

Routes are mounted under `/api` (for example `/api/auth`, problem and submission routes under `/api/...`). See `backend/src/server.js` for the full route map.

## Frontend setup

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Point the app at your API. Create `frontend/.env` (or `.env.local`) if needed:

   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

   Use the same host and port as your backend `PORT`. If you omit this variable, the client defaults to `http://localhost:5000/api`, so either set `PORT=5000` on the server or set `VITE_API_URL` to match your backend.

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Production build:

   ```bash
   npm run build
   npm run preview
   ```

## App routes (frontend)

| Path | Notes |
|------|--------|
| `/` | Home |
| `/login`, `/register` | Auth |
| `/problems` | Problem list (protected) |
| `/problems/new` | Create problem (protected) |
| `/problems/:id` | Problem detail and solving (protected) |
| `/profile` | User profile (protected) |

## License

No license is specified in this repository; add one if you plan to distribute or collaborate.
