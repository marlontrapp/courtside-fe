# CourtControl frontend

React SPA for [CourtControl](../courtside) — tennis court booking and club scheduling.

## Stack

- React 19 · TypeScript · Vite 8
- Tailwind CSS 4 · React Router 7
- TanStack Query · React Hook Form · Zod
- Oxlint · Prettier

Auth uses CourtControl’s Django **session** login (`/api-auth/login/`, email as `username`) with CSRF cookies. In development, Vite proxies `/api` and `/api-auth` to CourtControl so cookies stay same-origin.

## Prerequisites

- Node 20+ (see `.nvmrc` — Node 24 recommended)
- CourtControl API running (`make run` in the backend repo)

CourtControl’s `DJANGO_CSRF_TRUSTED_ORIGINS` should include `http://localhost:5173` (already set in the backend `.env.example`).

If something else already owns port **8000**, start CourtControl on another port and point the FE proxy at it:

```bash
# backend
RUN_ADDR=127.0.0.1:8001 make run

# frontend (.env)
VITE_API_PROXY_TARGET=http://127.0.0.1:8001
```

## Setup

```bash
nvm use
npm install
cp .env.example .env   # optional; empty VITE_API_BASE_URL uses the Vite proxy
npm run dev
```

Open http://localhost:5173/login

Dev seed users (password `player123`): `ana@example.com`, `bruno@example.com`, …  
Superuser: `admin@example.com` / `admin123`

## Scripts

| Command        | Purpose              |
|----------------|----------------------|
| `npm run dev`  | Vite dev server      |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Oxlint               |
| `npm run format` | Prettier write     |
| `npm run storybook` | Component Storybook on :6006 |
| `npm run build-storybook` | Static Storybook build |

## Storybook

Reusable UI lives in `src/components/` and is documented in Storybook (Courtside tokens + dark ink canvas):

```bash
npm run storybook
```

Open http://localhost:6006

## Project layout

```
src/
  api/          # fetch client + session auth helpers
  auth/         # AuthProvider + RequireAuth
  components/   # Shared UI primitives + *.stories.tsx
  layout/       # Authenticated app shell + side nav
  pages/        # Login, home, Clubs/Players/Courts placeholders
  App.tsx       # Router + providers
.storybook/     # Storybook Vite config + preview decorators
```
