# API Integration (Quran Foundation)

## Overview

The client integrates Quran Foundation APIs to enrich graph exploration with canonical verse content, translations, tafsir, audio recitation, and optional user-authenticated features.

## Integrated Routes

Server routes in `client/src/app/api/`:

- `auth/login/route.ts`
- `auth/logout/route.ts`
- `auth/me/route.ts`
- `bookmarks/route.ts`
- `bookmarks/[id]/route.ts`
- `quran/verse/[key]/route.ts`
- `quran/resources/route.ts`

## Authentication

OAuth flow is handled through:

- `client/src/app/callback/route.ts`
- session logic in `client/src/lib/session.ts`

Primary auth use case:

- Save and manage bookmarked ayat while browsing graph connections.

## Content Enrichment

When credentials are configured, the app can show:

- Uthmani verse text
- Word-by-word tokens
- Translation lines
- Tafsir commentary
- Recitation controls

Related UI components:

- `client/src/components/quran/TafsirPanel.tsx`
- `client/src/components/quran/WordTokens.tsx`
- `client/src/components/quran/AudioButton.tsx`

## Required Client Environment Variables

See `client/.env.example` for complete list. Core variables include:

- `QURAN_CLIENT_ID`
- `QURAN_CLIENT_SECRET`
- session/auth settings used by API routes

## Why This Matters for Judging

- Demonstrates practical API depth, not just static visualization.
- Connects extracted scholarly graph data to trusted live Quran resources.
- Adds user-level utility (bookmarking and personalized reading workflow).
