# OKNews24

App mobile per la lettura di news locali toscane da feed RSS, costruita con React Native/Expo e un backend FastAPI Python.

## Architecture (v2 - Supabase Edition)

- **Frontend**: React Native + Expo (TypeScript), Expo Router, porta 5000
- **Backend**: FastAPI (Python), httpx per chiamate REST a Supabase, porta 8000
- **Database**: Supabase PostgreSQL (progetto: `iencfxwfopjvwhuhmvsa`)
- **Auth**: Supabase Auth (email/password + Google OAuth via Supabase)
- **Email**: Resend API per email transazionali (reset password)
- **Payments**: Stripe integration

## Project Structure

```
frontend/
  app/          - File-based routes (Expo Router)
  components/   - UI components riutilizzabili
  contexts/     - AuthContext (Supabase), ThemeContext
  services/     - api.ts (axios client verso backend:8000)
  lib/          - supabase.ts (client @supabase/supabase-js)
  assets/       - Font, immagini
backend/
  server.py     - FastAPI server (Supabase edition, NO MongoDB)
  .env          - Chiavi JWT Supabase (non usare secrets Replit che hanno formato sbagliato)
  requirements.txt
supabase/
  schema.sql    - Schema PostgreSQL da eseguire nel SQL Editor di Supabase
```

## Workflows

- **Start application**: `cd frontend && npx expo start --web --port 5000`
- **Start Backend**: `cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload`

## Secrets / Environment Variables

- `SUPABASE_URL` = `https://iencfxwfopjvwhuhmvsa.supabase.co`
- `SUPABASE_ANON_KEY` - chiave JWT anon (deve iniziare con `eyJ...`)
- `SUPABASE_SERVICE_ROLE_KEY` - chiave JWT service role (deve iniziare con `eyJ...`)
  - **NOTA**: Le chiavi reali sono salvate in `backend/.env` (formato JWT corretto)
  - I secrets Replit hanno ancora il formato `sb_secret_/sb_publishable_` sbagliato
- `RESEND_API_KEY` - API key Resend per email
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe (opzionali)

## ⚠️ Setup Richiesto: Esegui Schema SQL in Supabase

Le tabelle PostgreSQL devono essere create eseguendo `supabase/schema.sql` nel
**SQL Editor** di Supabase: https://supabase.com/dashboard/project/iencfxwfopjvwhuhmvsa/sql/new

Tabelle create:
- `profiles` - profili utente (estende auth.users, trigger auto-create)
- `feeds` - feed RSS
- `articles` - articoli aggregati
- `saved_articles` - articoli salvati per utente
- `subscriptions` - abbonamenti Stripe
- `push_tokens` - token push notification
- `password_resets` - token reset password custom (6 char, 1 ora)
- `stripe_config` - cache configurazione Stripe

## API Configuration

Il frontend rileva automaticamente l'URL del backend:
- Web: `window.location.hostname:8000/api`
- Native: `localhost:8000/api`
- Override: `EXPO_PUBLIC_BACKEND_URL`

Il token di sessione è il JWT `access_token` di Supabase Auth, inviato come `Bearer` a ogni richiesta backend.

## Feed Sources (5 feed attivi)

1. `OK Mugello` — https://www.okmugello.it/mugello/feed/ (categoria: mugello)
2. `OK Valdisieve` — https://www.okvaldisieve.it/feed (categoria: valdisieve)
3. `OK Firenze` — https://www.okfirenze.com/feed (categoria: firenze)
4. `OK Mugello Magazine` — https://www.okmugello.it/magazine/feed (categoria: magazine)
5. `OK Sport` — https://www.okmugello.it/sport/feed (categoria: sport)

## Features

- Aggregazione RSS da 5 fonti news toscane
- Estrazione immagini da media:content, media:thumbnail, enclosures o HTML img tag
- **Galleria foto**: endpoint `/api/articles/{id}/gallery` scrapa `tb-gallery-container` dalla pagina web; fallback alle immagini inline del content RSS
- **Link cliccabili**: link nel content estratti in sezione "Link correlati" con Linking.openURL
- Modello freemium: 5 articoli gratuiti, poi abbonamento mensile/annuale
- Abbonamento via Stripe Checkout
- Push notification via Expo Push API
- Pannello admin per gestione feed, utenti, articoli
- Reset password via codice email (Resend)
