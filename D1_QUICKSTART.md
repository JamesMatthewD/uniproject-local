# D1 Agent Storage - Quick Start Guide

## 🚀 Setup Steps (5 minutes)

### Step 1: Create D1 Database
```bash
cd durable-object/durable-object-starter
npx wrangler d1 create poker_agents
```

**Output:** You'll see something like:
```
✅ Created D1 database 'poker_agents'

Database ID: e6e68547-33a9-4bc1-b87b-9a18ad3808e2
```

### Step 2: Update wrangler.jsonc (if needed)
Open `durable-object/durable-object-starter/wrangler.jsonc` and check:

```jsonc
"d1_databases": [
  {
    "binding": "POKER_AGENTS_DB",
    "database_name": "poker_agents",
    "database_id": "e6e68547-33a9-4bc1-b87b-9a18ad3808e2"  // <- Update if different
  }
]
```

> **Note:** The database_id should already be set to `e6e68547-33a9-4bc1-b87b-9a18ad3808e2`. If the command gave a different ID, update it here.

### Step 3: Create Database Table
```bash
# Option A: Run migration file
npx wrangler d1 execute poker_agents < migrations/001_create_agents_table.sql --local

# Option B: Run SQL directly (copy-paste into terminal)
npx wrangler d1 execute poker_agents "
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
"
```

### Step 4: Verify Setup
```bash
# Check if table exists
npx wrangler d1 execute poker_agents "SELECT * FROM agents;" --local

# Should output empty table if successful
```

### Step 5: Start Development Server
```bash
# From root directory
npm run dev

# Navigate to http://localhost:3000/agents
```

### Step 6: Test Upload
1. Go to `/agents` page
2. Paste example agent code (click "Download Example")
3. Give it a name
4. Click "Upload"
5. **You should see your Agent ID displayed** ✅

---

## 📊 How It Works Now

### Current Flow (Agents/session)
1. User uploads agent code
2. Server generates unique ID: `agent_<timestamp>_<random>`
3. ID displayed to user
4. Stored in `localStorage` for this browser session

### With D1 Integration
When you connect the API to D1 via the Durable Object:
1. Agent code saved to D1 database
2. User can share the Agent ID with others
3. Others can upload that ID in multiplayer/spectator mode
4. Works across browsers/devices/sessions

---

## 🔧 Next: Connect API to Durable Object (Optional)

To enable permanent D1 storage, update `/api/agents/save/route.js`:

```javascript
// Get Durable Object namespace from env
const pokerGameNamespace = req.env.POKER_GAME;
const roomId = "agents"; // Special room ID for agent operations
const roomObject = pokerGameNamespace.get(roomId);

// Call Durable Object to save
const response = await roomObject.fetch(new Request("http://durable-object/saveAgent", {
  method: "POST",
  body: JSON.stringify({ name, code })
}));

const data = await response.json();
return Response.json({ agentId: data.agentId });
```

This requires setting up **service bindings** in wrangler.jsonc.

---

## ✅ Verification Checklist

- [ ] D1 database created
- [ ] wrangler.jsonc has correct database_id
- [ ] agents table exists in D1
- [ ] Can upload agents on `/agents` page
- [ ] Agent ID is generated and displayed
- [ ] Agent ID appears in card list
- [ ] Can copy agent ID to clipboard

---

## 🐛 Troubleshooting

### "agents table does not exist"
```bash
# Recreate table
npx wrangler d1 execute poker_agents "DROP TABLE IF EXISTS agents;"
npx wrangler d1 execute poker_agents < migrations/001_create_agents_table.sql --local
```

### "Database not configured"
- Check wrangler.jsonc has the binding
- Check binding name is `POKER_AGENTS_DB`
- Check database_id matches your actual database

### Agent ID not generating
- Check browser console for errors
- Verify code passes validation (has exampleOpponent, call, fold, raise)
- Check network tab to see API response

---

## 📝 Agent Code Template

Copy this to test:

```javascript
const exampleOpponent = {
  call: function(gameInfo) {
    // Return true to call current bet
    return true;
  },
  
  fold: function(gameInfo) {
    // Return true to fold
    return false;
  },
  
  raise: function(gameInfo) {
    // Return {shouldRaise: true, amount: X} to raise
    return { shouldRaise: false, amount: 0 };
  }
};
```

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | D1 database configuration |
| `migrations/001_create_agents_table.sql` | Database schema |
| `src/durableObject.js` | `handleSaveAgent()` & `getAgentFromDB()` methods |
| `app/api/agents/save/route.js` | Agent upload endpoint |
| `app/agents/page.js` | Upload UI & localStorage persistence |

---

## 🎯 What's Happening Behind the Scenes

```
User clicks "Upload"
    ↓
Frontend validates code
    ↓
POST to /api/agents/save with name and code
    ↓
Server generates: agent_<timestamp>_<random>
    ↓
Returns ID to frontend
    ↓
Frontend shows success message with ID
    ↓
User copies ID (or it's saved in localStorage)
    ↓
Agent ID can be used in other sessions/browsers
```

---

## 🔐 Security Notes

- Agent code validated client-side (required methods)
- Agent code validated server-side (size limits)
- Sandboxed execution with 500ms timeout
- No access to sensitive data
- Cannot access file system or network

---

**Ready? Run the setup steps above and test uploading an agent!**
