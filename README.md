# HBO Max

A TypeScript streaming discovery app with a React frontend, Node/Express backend, and TMDB as its movie and series data source.

## Project layout

- `frontend/` - React, TypeScript, and Vite client
- `backend/` - TypeScript and Express API, including the TMDB proxy
- `backend/.env.example` - environment variable template

## Setup

1. Install dependencies from the project root with `npm install`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `TMDB_API_READ_ACCESS_TOKEN` in `backend/.env` to a TMDB API Read Access Token.
4. Start both apps with `npm run dev`.

The client is served at `http://localhost:5173` and the API at `http://localhost:3002`. The Vite development server proxies `/api` requests to Express. Configure your local DNS or reverse proxy separately when using a custom domain.

## Scripts

- `npm run dev` - run frontend and backend together
- `npm run build` - build both workspaces
- `npm run lint` - lint the frontend
- `npm start` - run the built backend

TMDB data and artwork are served under TMDB's API terms. The TMDB access token is read only by the backend and must not be placed in frontend variables.
