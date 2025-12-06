# Task Orchestrator

Adaptive, frontend-only planner that auto-slots household chores, gym blocks, contest prep, and meal routines into your real week. Everything runs in the browser using local storage, so deployment is as simple as serving the static bundle.

## Features

- Recurring templates for gap-based, weekly, or single-date tasks.
- Smart scheduler that honors office/WFH days, gym routines, and manual contest holds.
- Instant controls to mark a task done, skip it to tomorrow, or jot a note.
- Manual reservations for Codeforces contests or CTF windows so nothing collides.
- Fully responsive UI with dark theme optimized for phones and laptops.

## Getting started

```bash
npm install
npm run dev
```

The app persists everything in `localStorage` (`task-orchestrator-*` keys), so refreshing the page keeps your data. The Vite dev server is configured to listen on port `8006` and accept the host `tasks.ayux.in`, so you can tunnel that domain locally or point DNS straight at your box.

## Build & deploy

```bash
npm run build
```

The static bundle lives in `dist/`. Use the included `Dockerfile` to run it behind a lightweight Node server or deploy to any static host.

## Docker image

```
docker build -t task-orchestrator .
docker run -d -p 8006:8006 task-orchestrator
```

The container serves the production bundle via Vite preview on port 8006.

## GitHub Actions deploy

`.github/workflows/deploy.yml` targets your existing self-hosted Linux runner (same labels as the CCTV workflow). It builds the Docker image on each push to `main`, replaces the running container, and injects secrets such as `TZ` if needed.

## Unified backend

The shared FastAPI backend that will eventually connect Tasks, Food, Gym, and CCTV now lives in `backend/`. It exposes REST endpoints plus media upload routes and ships with Alembic migrations + Docker assets. See `backend/README.md` for setup instructions.

This application is still in development

# This app is under dev