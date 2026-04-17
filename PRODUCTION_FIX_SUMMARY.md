# Cloudflare Multiplayer Poker - Production Fix Summary

## 🎯 What Was Wrong

When deployed to Cloudflare, the multiplayer lobby didn't work because:
- API routes were hardcoded to connect to `http://localhost:8787` (local dev only)
- Cloudflare doesn't have localhost - it needs actual HTTP URLs or service bindings
- Players weren't appearing in the lobby because requests were failing silently

## ✅ What Was Fixed

### 1. API Routes Updated (4 files)
All poker API routes now support production environments:
- ✅ `app/api/poker/create/route.js`
- ✅ `app/api/poker/join/route.js`
- ✅ `app/api/poker/state/route.js`
- ✅ `app/api/poker/action/route.js`

**Change:** They now check for `DURABLE_OBJECT_URL` environment variable
- **In production:** Uses your Cloudflare Durable Object URL
- **In development:** Falls back to `http://localhost:8787`

### 2. Durable Object Worker Updated
`durable-object/durable-object-starter/src/index.js` now:
- ✅ Uses actual Durable Object bindings in production (`env.POKER_GAME`)
- ✅ Routes `/poker/{gameId}` requests to the Durable Object
- ✅ Keeps local in-memory games for development

## 🚀 Quick Deploy (3 Steps)

### Step 1: Deploy Durable Object Worker
```bash
cd durable-object/durable-object-starter
wrangler deploy
```

**Copy the URL from output.** It looks like: `https://durable-object-starter-xxxxx.workers.dev`

### Step 2: Update Environment Variable

**Option A: In your wrangler.json** (for Next.js deployment)
```json
{
  "vars": {
    "DURABLE_OBJECT_URL": "https://durable-object-starter-xxxxx.workers.dev/poker"
  }
}
```

**Option B: Cloudflare Dashboard**
1. Go to Workers → Select your Next.js worker
2. Settings → Variables
3. Add: `DURABLE_OBJECT_URL` = `https://durable-object-starter-xxxxx.workers.dev/poker`

### Step 3: Deploy Next.js App
```bash
# From root directory
wrangler deploy
# or
npm run deploy
```

## ✅ After Deployment - Testing

1. Go to your deployed app (Cloudflare URL)
2. Click "Create Game" in multiplayer
3. **You should see your player in the lobby** ✅
4. Open another browser/incognito and join the same game code
5. **Both players should appear** ✅

## 🔧 Verify It's Working

**Check 1: Durable Object is accessible**
```bash
# Replace with your actual URL
curl "https://your-worker.workers.dev/poker/test-123"
```
Should return JSON, not 404 or error

**Check 2: Environment variable is set**
Check Cloudflare Dashboard → Workers → Your worker → Settings → Variables
Should show `DURABLE_OBJECT_URL` set to your Durable Object URL

**Check 3: Browser console for errors**
Open DevTools → Console
Should NOT show fetch errors like "localhost:8787" or "failed to connect"

## 📋 Architecture

```
Browser (Cloudflare Worker)
    ↓
API Route: /api/poker/create
    ↓
Fetch to: env.DURABLE_OBJECT_URL (e.g., https://your-worker.workers.dev/poker/{gameId})
    ↓
Durable Object Worker (fetches)
    ↓
Routes to actual Durable Object instance (PokerGame)
    ↓
Returns game state
```

## 🐛 If It Still Doesn't Work

**Check the logs:**
```bash
# View Durable Object worker logs
wrangler tail durable-object-starter

# View Next.js worker logs  
wrangler tail your-nextjs-worker
```

**Common Issues:**
1. **"localhost:8787 not reachable"** 
   - Environment variable not set, falling back to localhost
   - Fix: Set `DURABLE_OBJECT_URL` in Cloudflare

2. **"404 Not Found on Durable Object URL"**
   - URL is wrong or doesn't include `/poker`
   - Fix: Verify URL in environment variable, should end with `/poker`

3. **"Players in console but not appearing in UI"**
   - Polling working but UI not updating
   - Check browser console for React errors
   - May need to restart browser

4. **"Worked yesterday, broken today"**
   - Cloudflare might have redeployed your workers
   - Redeploy both services: `wrangler deploy`

## 📚 Files Changed

| File | Change |
|------|--------|
| `app/api/poker/create/route.js` | Check env variable first, fallback to localhost |
| `app/api/poker/join/route.js` | Check env variable first, fallback to localhost |
| `app/api/poker/state/route.js` | Check env variable first, fallback to localhost |
| `app/api/poker/action/route.js` | Check env variable first, fallback to localhost |
| `durable-object/src/index.js` | Use Durable Object binding in production |
| `CLOUDFLARE_DEPLOYMENT_GUIDE.md` | New detailed deployment guide |

## 🚢 Next Steps

1. ✅ Deploy Durable Object worker
2. ✅ Set environment variable
3. ✅ Deploy Next.js app  
4. ✅ Test in browser
5. Add to your CI/CD pipeline for future deployments

## 💡 How Local Development Still Works

When running locally (`npm run dev`):
1. Next.js app runs on `http://localhost:3000`
2. Durable Object runs on `http://localhost:8787`
3. API routes detect no env variable
4. Fallback to `http://localhost:8787`
5. Everything works locally without changes ✅

---

**Questions?** Check the detailed guide: `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
