# AgriVision React frontend

## Development

1. Start the API from the repo root: `python run.py` (port 8000).
2. Add `.env.local` (or `.env`) with `VITE_CLERK_PUBLISHABLE_KEY` from the [Clerk API keys](https://dashboard.clerk.com/~/api-keys) page (React). Install SDK: `npm install @clerk/react@latest`.
3. Run `npm install` and `npm run dev` (Vite proxies `/api` and `/static` to the backend).

Open http://localhost:5173

## Production build served by FastAPI

1. Set `VITE_APP_BASE=/react/` and run `npm run build`.
2. With `frontend/dist` present, FastAPI mounts the SPA at http://localhost:8000/react/ (see `backend/app_fastapi.py`).

## Auth note

The API accepts the Clerk session cookie on same-origin requests. From the Vite dev server, JWTs from `getToken()` are sent on `Authorization: Bearer` and verified in `backend/auth.py` using your `CLERK_FRONTEND_API` JWKS.
