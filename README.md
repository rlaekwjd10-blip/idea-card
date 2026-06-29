# idea-card

Dark idea board built with React and Vite.

## Run locally

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the SQL in `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

When the Supabase env vars are present, the app stores ideas and likes in Supabase. Without them, it falls back to `localStorage`.

## Vercel env vars

Add the same variables in Vercel Project Settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
