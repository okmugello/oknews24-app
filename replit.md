# OKNews24

A mobile news reader app that aggregates RSS feeds from Tuscan local news sources, built with React Native/Expo and a FastAPI backend.

## Architecture

- **Frontend**: React Native + Expo (TypeScript), Expo Router for file-based navigation
- **Backend**: FastAPI (Python) with Motor (async MongoDB driver)
- **Database**: MongoDB (external, connected via `MONGO_URL` secret)
- **Auth**: JWT-based authentication
- **Payments**: Stripe integration (configured via environment variables)

## Project Structure

```
frontend/     - Expo React Native app
  app/        - File-based routes (Expo Router)
  components/ - Reusable UI components
  contexts/   - Auth and Theme React contexts
  services/   - API service layer (api.ts)
  assets/     - Fonts, images
backend/
  server.py   - FastAPI server with all endpoints
  requirements.txt
memory/       - PRD and project docs
tests/        - Test files
```

## Workflows

- **Start application**: `cd frontend && npx expo start --web --port 5000` (port 5000, webview)
- **Start Backend**: `cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload` (port 8000, console)

## Key Environment Variables / Secrets

- `MONGO_URL` - MongoDB connection string (required)
- `JWT_SECRET` - JWT signing secret (optional, defaults to dev value)
- `STRIPE_SECRET_KEY` - Stripe secret key (optional)
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (optional)
- `SMTP_HOST`, `SMTP_PORT` - Email configuration (optional)

## API Configuration

The frontend automatically detects the backend URL:
- On web: uses `window.location.hostname:8000/api`
- On native: uses `localhost:8000/api`
- Override with `EXPO_PUBLIC_BACKEND_URL` env var

## Features

- RSS feed aggregation from Tuscan news sources
- Freemium model: 5 free articles, then subscription required
- Monthly/yearly subscription via Stripe
- Push notifications via Expo
- Admin panel for feed management
- JWT authentication with email/password
