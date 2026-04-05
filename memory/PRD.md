# OKNews24 - Product Requirements Document

## Overview
OKNews24 is a mobile news reader app that aggregates RSS feeds from local Tuscan news sources. Users can read news with a freemium model - 5 free articles trial, then subscription required.

## Features

### Authentication
- Email/Password registration and login
- Google OAuth (Emergent Auth) - available for future mobile builds
- Session management with JWT tokens

### User Types
1. **Trial User**: New registered users with 5 free article reads
2. **Subscribed User**: Monthly (€4/month) or Yearly (€36/year) subscribers with unlimited access
3. **Admin**: Full access + user management + feed management + statistics

### Core Features
1. **News Feed**: Browse articles from multiple RSS sources
2. **Article Detail**: Read full article content with link to original source
3. **Feed Filtering**: Filter articles by source/category
4. **Subscription Management**: View plans and subscribe (MOCKED payments)
5. **Profile**: User info, subscription status, reading stats

### Admin Features
1. **User Management**: View, search, edit roles, manage subscriptions, delete users
2. **Feed Management**: Add, edit, delete RSS feeds
3. **Statistics Dashboard**: User counts, content stats
4. **Article Refresh**: Manually trigger feed refresh

## RSS Feed Sources (Default)
1. OK Mugello - https://www.okmugello.it/mugello/feed
2. OK Mugello Magazine - https://www.okmugello.it/magazine/feed
3. OK Mugello Sport - https://www.okmugello.it/sport/feed
4. OK Firenze - https://www.okfirenze.com/feed
5. OK Valdisieve - https://www.okvaldisieve.it/feed

## Subscription Plans
1. **Monthly**: €4/month - 30 days unlimited access
2. **Yearly**: €36/year (€3/month) - 365 days unlimited access

## Technical Stack
- **Frontend**: Expo React Native with TypeScript
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT tokens + Emergent Google OAuth
- **Payments**: MOCKED (Stripe integration planned)

## Status
- MVP Complete
- Payment integration: MOCKED (to be implemented with Stripe)
- Google OAuth: Backend ready, mobile integration pending
