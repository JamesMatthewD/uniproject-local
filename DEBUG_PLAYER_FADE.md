# Debugging: Player Fades Away After Join

## 🎯 The Problem You're Experiencing

1. **Join works:** Player appears in lobby ✅
2. **Then fades away:** Player disappears after a few seconds ❌

This happens because:
- **Join API** works and returns correct state with player
- **State polling** starts and fails to connect to Durable Object
- **Fallback returns empty data** → player list becomes empty
- **UI updates** → player disappears

## ✅ What Was Fixed

### 1. Better Error Handling in State Endpoint
**File:** `app/api/poker/state/route.js`

Now includes:
- ✅ 5-second timeout detection
- ✅ Returns 503 Service Unavailable (not empty data) on failure
- ✅ Detailed console logging to see exactly what's failing
- ✅ Doesn't clear game state on temporary errors

### 2. Client-Side State Preservation
**File:** `app/multiplayer/page.js`

Now:
- ✅ Only updates state on successful (200) responses
- ✅ Ignores 503 errors (keeps previous state)
- ✅ Keeps previous state on network errors
- ✅ Logs warnings instead of failing silently

## 🔍 How to Debug This

### Step 1: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Join a game
4. Look for these messages:

**Good (player stays):**
```
State fetch successful for game_abc123: 1 players
State fetch successful for game_abc123: 2 players
```

**Bad (player fades):**
```
Durable Object unavailable (503), keeping previous state
Failed to get state from Durable Object: ...
```

### Step 2: Check Cloudflare Worker Logs

```bash
# View API worker logs
wrangler tail your-nextjs-worker

# View Durable Object worker logs
wrangler tail durable-object-starter
```

Look for:
- `Failed to get state from Durable Object` - DO is not responding
- `Durable Object returned status 503` - DO is returning error
- `Durable Object request timeout` - Request took too long

### Step 3: Verify Environment Variable is Set

**Option A: Check Cloudflare Dashboard**
1. Go to Workers → Select your Next.js worker
2. Settings → Variables
3. Look for `DURABLE_OBJECT_URL`
4. Should be: `https://your-durable-object.workers.dev/poker`

**Option B: Log the value in API route**

Add this to `app/api/poker/state/route.js`:
```javascript
console.log("DURABLE_OBJECT_URL:", process.env.DURABLE_OBJECT_URL);
console.log("Using URL:", durableObjectUrl);
```

Then check logs:
```bash
wrangler tail your-nextjs-worker
```

If output shows `http://localhost:8787` → **environment variable is NOT set** ❌

## 🚀 Most Likely Cause (90% of Cases)

**The environment variable is not set on Cloudflare.** 

This causes:
1. API routes default to `http://localhost:8787`
2. First call might work (sometimes)
3. Subsequent calls fail (localhost doesn't exist on Cloudflare)
4. Player fades away

### Quick Fix:

**If using Cloudflare Dashboard:**
1. Go to Workers → Your Next.js worker
2. Settings → Environment Variables
3. Add new variable:
   - Name: `DURABLE_OBJECT_URL`
   - Value: `https://durable-object-starter-xxxxx.workers.dev/poker`
4. Save and redeploy

**If using wrangler.json:**
```json
{
  "env": {
    "production": {
      "vars": {
        "DURABLE_OBJECT_URL": "https://durable-object-starter-xxxxx.workers.dev/poker"
      }
    }
  }
}
```

Then redeploy:
```bash
wrangler deploy --env production
```

## 📊 Testing Checklist

- [ ] Environment variable `DURABLE_OBJECT_URL` is set
- [ ] URL includes `/poker` at the end
- [ ] Durable Object worker is deployed
- [ ] Next.js worker is redeployed after setting env var
- [ ] Check browser console - should see "State fetch successful"
- [ ] Check Cloudflare logs - should see successful DO calls
- [ ] Player stays in lobby after joining
- [ ] Can see other players joining

## 🔧 Additional Debug Logging

If you want more visibility, add this to `app/api/poker/state/route.js` before the fetch:

```javascript
console.log(`[State Request] GameID: ${gameId}`);
console.log(`[State Request] Using URL: ${durableObjectUrl}`);
console.log(`[State Request] Env var set: ${!!process.env.DURABLE_OBJECT_URL}`);
```

Then redeploy and check:
```bash
wrangler tail your-nextjs-worker --follow
```

You'll see exactly what's happening:
```
[State Request] GameID: game_abc123
[State Request] Using URL: https://durable-object-starter-xxxxx.workers.dev/poker/game_abc123
[State Request] Env var set: true
State fetch successful for game_abc123: 1 players
```

## 🐛 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Player fades immediately | Env var not set | Set `DURABLE_OBJECT_URL` in Cloudflare |
| Works once then fails | DO URL wrong | Check URL ends with `/poker` |
| Console shows `localhost:8787` | Env var not being read | Redeploy after setting var |
| "Cannot fetch http://localhost" | No env var fallback | Set env var on Cloudflare |
| Timeout errors | DO taking too long | May need to restart DO |

## 🚀 Next Steps

1. **Verify environment variable is set**
   ```bash
   # View current deployment config
   wrangler deployments list
   ```

2. **Check the logs**
   ```bash
   wrangler tail your-nextjs-worker --lines 100
   ```

3. **Look for these patterns:**
   - ✅ `DURABLE_OBJECT_URL: https://...` - Variable is set
   - ❌ `DURABLE_OBJECT_URL: undefined` - Variable NOT set
   - ✅ `State fetch successful` - Connection working
   - ❌ `Durable Object unavailable` - Connection failing

4. **If variable not set:**
   - Go to Cloudflare Dashboard
   - Add the variable
   - Redeploy

5. **Test again:**
   - Create game
   - Watch console for "State fetch successful"
   - Player should now stay in lobby ✅

---

**Having issues?** Share the console output and log messages and I can help further!
