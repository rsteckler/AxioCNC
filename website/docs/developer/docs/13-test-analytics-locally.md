---
id: 13-test-analytics-locally
sidebar_position: 13
title: Test Analytics Locally
---

# Test Analytics Locally

This guide explains how to set up Aptabase Analytics for local development and testing.

## Quick Setup

### 1. Create `.env.local` file

Create a `.env.local` file in the project root:

```bash
# Frontend key (used by Vite)
VITE_APTABASE_KEY=your-aptabase-key-here

# Backend key (used by generate script)
APTABASE_KEY=your-aptabase-key-here
```

Replace `your-aptabase-key-here` with your actual Aptabase app key (starts with `A-`).

### 2. Backend Key (Optional - Auto-detected)

The backend will automatically read `APTABASE_KEY` from `.env.local` - **no script needed for local dev!**

The generator script (`developers/scripts/generate-aptabase-key.js`) is only used in CI builds to bake the key into the package. For local development, the backend reads directly from `process.env.APTABASE_KEY`.

### 3. Start Development Servers

**Frontend:**
```bash
pnpm dev:start-app
# Vite will automatically read VITE_APTABASE_KEY from .env.local
```

**Backend:**
```bash
pnpm dev:start-server
# Backend will read from the generated aptabase-key.js file
```

## Alternative: Environment Variables

If you prefer not to use `.env.local`, you can export variables before running:

```bash
# Frontend
export VITE_APTABASE_KEY=your-key-here
pnpm dev:start-app

# Backend (reads directly from env var - no script needed)
export APTABASE_KEY=your-key-here
pnpm dev:start-server
```

**Note:** The generator script is only needed for CI builds, not local development.

## Verifying It Works

1. Enable analytics in Settings → About → "Anonymous Usage Data"
2. Check browser console (dev mode) - should see analytics initializing
3. Perform actions (change settings, connect controller, etc.)
4. Check Aptabase dashboard - events should appear within a few seconds

## Testing Offline Behavior

1. Disable your network connection
2. Use the app normally
3. Check console - should see no errors (analytics fails silently)
4. Re-enable network - queued events should send automatically

## Notes

- `.env.local` is gitignored and won't be committed
- The backend key file (`apps/server/src/config/aptabase-key.js`) is also gitignored
- If you don't set a key, analytics will be disabled (graceful degradation)
- Analytics only works if user has enabled it in settings
