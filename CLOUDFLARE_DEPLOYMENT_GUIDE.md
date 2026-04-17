# Cloudflare Multiplayer Poker - Production Deployment Guide

## Problem
When deployed to Cloudflare, the online multiplayer section doesn't work because the API routes try to connect to `http://localhost:8787` (local development URL), which doesn't exist in production.

## Solution

### 1. Expose Durable Object via HTTP Stub

The Durable Object worker needs to be publicly accessible. Add an HTTP handler to your Durable Object entry point.

Edit `durable-object/durable-object-starter/src/index.js`:

```javascript
import { PokerGame } from './durableObject';

export { PokerGame };

// Export a fetch handler for the worker itself
export default {
  fetch: async (request, env) => {
    const url = new URL(request.url);
    
    // Route requests to Durable Objects
    if (url.pathname.startsWith('/poker/')) {
      const gameId = url.pathname.split('/')[2];
      const id = env.POKER_GAME.idFromName(gameId);
      const obj = env.POKER_GAME.get(id);
      return obj.fetch(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

### 2. Deploy Both Services

```bash
# Deploy the Durable Object worker
cd durable-object/durable-object-starter
wrangler deploy

# This gives you a URL like: https://durable-object-starter.username.workers.dev

# Deploy the Next.js app
cd ../..
wrangler deploy  # or your Next.js deployment method
```

### 3. Set Environment Variable

Once deployed, set the Durable Object URL as an environment variable in your Next.js app.

In your `wrangler.json` for the Next.js app:

```json
{
  "vars": {
    "DURABLE_OBJECT_URL": "https://durable-object-starter.username.workers.dev/poker"
  }
}
```

Or in Cloudflare Dashboard → Workers → Settings → Variables:
- Variable name: `DURABLE_OBJECT_URL`
- Value: `https://durable-object-starter.username.workers.dev/poker`

### 4. How It Works

**Development (local):**
```
Next.js API route → http://localhost:8787/poker/{gameId}
  ↓
Local Durable Object
```

**Production (Cloudflare):**
```
Next.js Worker → env.DURABLE_OBJECT_URL (from wrangler.json)
  ↓
https://durable-object-starter.username.workers.dev/poker/{gameId}
  ↓
Durable Object Worker → Routes to actual Durable Object
  ↓
PokerGame Instance
```

## Updated API Routes

All poker API routes now check for `DURABLE_OBJECT_URL` environment variable:

- ✅ `/api/poker/create` - Checks env variable first
- ✅ `/api/poker/join` - Checks env variable first
- ✅ `/api/poker/state` - Checks env variable first
- ✅ `/api/poker/action` - Checks env variable first

If not set, falls back to `http://localhost:8787` for development.

## Step-by-Step Deployment

### 1. Update the Durable Object Worker

Edit `durable-object/durable-object-starter/src/index.js` and add the fetch handler above.

### 2. Deploy Durable Object Worker

```bash
cd durable-object/durable-object-starter
wrangler deploy
# Output will show:
# ✓ Your worker has been published to https://durable-object-starter-xxxxx.workers.dev
```

**Copy the URL** shown in output.

### 3. Update Next.js wrangler.json

```json
{
  "vars": {
    "DURABLE_OBJECT_URL": "https://durable-object-starter-xxxxx.workers.dev/poker"
  }
}
```

### 4. Deploy Next.js App

```bash
# From root directory
wrangler deploy
```

### 5. Test in Production

1. Go to your deployed Next.js app
2. Click "Create Game" in multiplayer
3. **Client should now appear in lobby** ✅

## Debugging

### If players still don't appear:

**Check 1: Verify Durable Object URL is correct**
```bash
curl "https://your-worker-url.workers.dev/poker/test-game-123"
```
Should return JSON (not 404)

**Check 2: Verify environment variable is set**
In your Next.js worker, add console logging:
```javascript
console.log("DURABLE_OBJECT_URL:", process.env.DURABLE_OBJECT_URL);
```

**Check 3: Check CORS**
Make sure both workers are on Cloudflare (no CORS issues between same platform)

**Check 4: Check browser console for fetch errors**
Open DevTools → Console and look for fetch errors

### If localhost development stopped working:

Make sure your local Durable Object is still running:
```bash
cd durable-object/durable-object-starter
wrangler dev
```

Should see: `Listening on http://localhost:8787`

## File Changes

- ✅ `app/api/poker/create/route.js` - Uses env variable
- ✅ `app/api/poker/join/route.js` - Uses env variable  
- ✅ `app/api/poker/state/route.js` - Uses env variable
- ✅ `app/api/poker/action/route.js` - Uses env variable
- ⏳ `durable-object/durable-object-starter/src/index.js` - Needs fetch handler added

## Alternative: Direct Cloudflare Setup

If you want to combine everything into one Worker:

Instead of separate workers, you could:
1. Move Durable Object logic into the main worker
2. Have all API routes use the local binding directly
3. Single deployment to Cloudflare

This is more complex but eliminates the inter-worker communication requirement.

## FAQ

**Q: Do I need to redeploy every time I change the Durable Object URL?**
A: Yes, environment variables are set at deploy time. Redeploy after updating.

**Q: Can I use a custom domain?**
A: Yes! Map your custom domain to the Worker URL in Cloudflare Dashboard → Domains

**Q: Why does it work locally but not in production?**
A: Local wrangler has direct access to Durable Objects. Production requires HTTP communication between separate services.

**Q: Can I skip the separate Durable Object deployment?**
A: Yes, but you'd need to combine everything into one worker (more complex).

## What's Next

Once multiplayer works in production:
1. Test spectator AI mode
2. Verify D1 database agents work
3. Test custom agent uploads
4. Monitor for latency issues (may need to optimize polling interval)

---

**Need help?** Check that:
- [ ] Durable Object worker deploys successfully
- [ ] Fetch handler is added to `index.js`
- [ ] Environment variable is set to correct URL
- [ ] Environment variable includes `/poker` path
- [ ] No CORS errors in browser console
- [ ] Localhost dev still works with local wrangler
