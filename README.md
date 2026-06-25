
## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `pnpm install`
2. Set the required variables in `.env.local`
   Local-only minimum:
   - `GEMINI_API_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   Optional for local:
   - `GEMINI_OCR_MODEL`
   - `GEMINI_JUMP_MODEL`
   - `APP_URL`
   - All Supabase variables
3. Run the app:
   `pnpm dev`

When Supabase env vars are unset, uploads and summaries are stored locally under `public/uploads`. When Supabase env vars are present, the app keeps the current Supabase storage and sync behavior.

## Deploy on Dokploy

This repo is ready to deploy on Dokploy with the included `Dockerfile`.

Use these settings in Dokploy:

1. Create a new **Application** from your Git repository.
2. Select the branch:
   `codex/dokploy-deploy`
3. Set **Build Type** to:
   `Dockerfile`
4. Set the container port to:
   `3000`
5. Add the required environment variables from `.env.example`.

Required environment variables for production:

- `GEMINI_API_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Optional environment variables:

- `GEMINI_OCR_MODEL`
- `GEMINI_JUMP_MODEL`
- `APP_URL`
- `EDITORPULSE_UPLOADS_DIR`

If Supabase is not configured, the Docker image stores uploads and OCR summaries under:

- `/data/editorpulse/uploads`

In Dokploy, add persistent storage for that path so uploaded editions survive restarts and redeploys:

- Mount path: `/data/editorpulse/uploads`

Optional but recommended for production persistence and cross-instance sync:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `EDITORPULSE_API_KEY`

Recommended production values:

- `GEMINI_OCR_MODEL=gemini-2.5-flash`
- `GEMINI_JUMP_MODEL=gemini-2.5-pro`
- `NODE_ENV=production`

Notes:

- Without Supabase, uploads and OCR results persist through the Dokploy volume above.
- With Supabase env vars present, the app keeps syncing publications, editions, and page files to Supabase.
- `APP_URL` should be your Dokploy domain, for example `https://editorpulse.yourdomain.com`.
