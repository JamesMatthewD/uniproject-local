# D1 Agent Database Integration Setup

## Overview

This document explains how the D1 database integration works for storing and retrieving custom poker agents. The system allows players to upload agent code that persists across sessions.

## Architecture

```
Frontend (agents/page.js)
    ↓
    POST /api/agents/save (with name, code)
    ↓
API Route (/api/agents/save/route.js)
    ↓
Generates unique agentId
    ↓
Returns agentId to frontend
    ↓
Frontend displays to user and saves to localStorage
```

**Future Enhancement (with Durable Object service binding):**
```
API Route → Durable Object (service binding) → D1 Database → Agent stored permanently
```

## Current Setup Status

### ✅ Completed
- Durable Object methods: `handleSaveAgent()` and `getAgentFromDB()`
- D1 binding configured in wrangler.jsonc
- D1 database ID set: `e6e68547-33a9-4bc1-b87b-9a18ad3808e2`
- Agent caching system implemented
- Frontend displays agent IDs
- localStorage persistence working

### ⏳ Requires Manual Setup

1. **Create D1 Table Schema**
   ```bash
   # First, create the database if not already created
   npx wrangler d1 create poker_agents
   ```

2. **Create Agents Table**
   Run these SQL commands via Wrangler:
   ```sql
   CREATE TABLE IF NOT EXISTS agents (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     code TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);
   ```

3. **Update wrangler.jsonc**
   If you see a new database_id from the `d1 create` command, update:
   ```jsonc
   "d1_databases": [
     {
       "binding": "POKER_AGENTS_DB",
       "database_name": "poker_agents",
       "database_id": "YOUR_DATABASE_ID_HERE"
     }
   ]
   ```

## How It Works

### Agent Upload Flow

1. **User uploads agent on `/agents` page**
   - Code validated client-side
   - Checks for required methods (call, fold, raise)

2. **POST to `/api/agents/save`**
   - Server validates name and code size
   - Generates unique agent ID: `agent_<timestamp>_<random>`
   - Returns agentId to frontend

3. **Frontend displays agent ID**
   - Shows in success message box
   - Copy-to-clipboard functionality
   - Saved to localStorage

4. **Agent stored locally for session**
   - Retrieved from localStorage when page reloads
   - Can be used in multiplayer/spectator modes

### Agent Retrieval (Future - with D1)

When D1 service binding is configured:

1. **Durable Object method: `getAgentFromDB(agentId)`**
   - Queries D1 for agent by ID
   - Returns agent code
   - Caches result in memory

2. **Durable Object method: `executeCustomAgent(agentId, gameInfo)`**
   - Checks cache first
   - Falls back to `getAgentFromDB` if not cached
   - Runs agent in sandboxed environment
   - Timeout protection (500ms)
   - Returns action decision

## Implementation Details

### Agent ID Format
```
agent_<timestamp>_<random>
Example: agent_1713380592345_abc12def
```

- **Timestamp**: Current milliseconds (ensures uniqueness)
- **Random**: 9 random alphanumeric characters (extra uniqueness)
- **Unique**: Astronomically unlikely to collide

### Agent Sandbox Execution

```javascript
// When agent is called from game
const decision = await this.executeCustomAgent(agentId, gameInfo);
// Returns: { action: "call"|"fold"|"raise"|"check", amount: number }
```

**Sandbox Features:**
- 500ms execution timeout
- Isolated function scope
- Method validation before execution
- Error handling with fallback ("check" action)
- Deep copy of gameInfo (prevents mutation)
- Raise amount capping (max 1000)

## Database Schema

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,           -- agent_<timestamp>_<random>
  name TEXT NOT NULL,            -- User-provided name
  code TEXT NOT NULL,            -- JavaScript code with exampleOpponent export
  created_at DATETIME            -- When agent was uploaded
);
```

## Frontend Usage

### Upload Agent
```javascript
// User uploads on /agents page
const response = await fetch("/api/agents/save", {
  method: "POST",
  body: JSON.stringify({
    name: "My Aggressive Agent",
    code: "const exampleOpponent = { call: () => true, ... }"
  })
});

const data = await response.json();
console.log(data.agentId); // agent_1713380592345_abc12def
```

### Use Agent in Multiplayer
```javascript
// In future: allow entering agent ID in spectator/multiplayer
const agentId = "agent_1713380592345_abc12def"; // User provides this
// Pass to Durable Object which fetches from D1
```

## Testing

### Local Development
1. Agents upload successfully
2. IDs displayed to user
3. Stored in localStorage
4. Can be copied to clipboard

### With D1 (After Setup)
1. `npx wrangler dev` to start local server
2. Upload agent via `/agents` page
3. Check D1 with: `npx wrangler d1 execute poker_agents --local "SELECT * FROM agents;"`
4. Should see your agent in the database

## Future Enhancements

1. **Service Binding Integration**
   - Update API route to call Durable Object via service binding
   - Persist agents to D1 instead of generating IDs

2. **User Accounts**
   - Associate agents with authenticated users
   - Load user's agents on login

3. **Agent Discovery**
   - Public agent library
   - Rate/comment on agents
   - Agent version management

4. **Direct Agent ID Input**
   - Allow entering agent ID in multiplayer/spectator games
   - Load agent from D1 automatically

5. **Agent Versioning**
   - Store multiple versions of agents
   - Roll back to previous versions

## Troubleshooting

### "Database not configured" Error
- Check wrangler.jsonc has `POKER_AGENTS_DB` binding
- Ensure database_id is set
- Run `npx wrangler d1 info poker_agents` to verify

### "INSERT" Fails
- Database table doesn't exist yet
- Run SQL CREATE TABLE command (see above)

### Agent Not Found When Trying to Use
- Agent not yet in D1 (still in localStorage only)
- Use agent ID from same session
- Full D1 integration needed for cross-session access

## Files Modified

1. **durable-object/durable-object-starter/wrangler.jsonc**
   - D1 binding already configured

2. **durable-object/durable-object-starter/src/durableObject.js**
   - Added `handleSaveAgent(data)` method
   - Added `getAgentFromDB(agentId)` method
   - Updated `executeCustomAgent()` to use getAgentFromDB
   - Added `/saveAgent` route handler

3. **app/api/agents/save/route.js**
   - Added endpoint validation
   - Generates unique agent IDs
   - Ready for D1 service binding

4. **app/agents/page.js**
   - Already integrated with API endpoint
   - Displays agent IDs to users
   - localStorage persistence

## Next Steps

1. Run the D1 setup commands above
2. Test uploading agents locally
3. Verify agents appear in D1 via Wrangler CLI
4. (Optional) Implement service binding for automatic D1 persistence
