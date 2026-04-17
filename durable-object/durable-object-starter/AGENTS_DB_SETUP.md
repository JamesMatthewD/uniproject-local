# Custom Agents Database Setup

This guide explains how to set up the D1 database for storing and executing custom AI agents.

## Quick Setup

### 1. Create the Database

If you haven't already, create a D1 database named `poker_agents`:

```bash
npx wrangler d1 create poker_agents
```

This will output a database ID. Copy it and update `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "POKER_AGENTS_DB",
    "database_name": "poker_agents",
    "database_id": "your-database-id-here"
  }
]
```

### 2. Create the Schema

Run this SQL to create the agents table:

```bash
npx wrangler d1 execute poker_agents --remote --command "
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
"
```

Or locally:

```bash
npx wrangler d1 execute poker_agents --local --command "
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
"
```

## API Endpoints to Add

Add these to your Next.js API routes to manage agents in D1:

### POST /api/agents/save
Save a custom agent to the database

```javascript
// Request body:
{
  "id": "agent-123",
  "name": "MyAwesomeBot",
  "code": "export const exampleOpponent = { call: ..., fold: ..., raise: ... }",
  "createdBy": "user@example.com"
}
```

### GET /api/agents/list
List all available agents

### GET /api/agents/:agentId
Fetch a specific agent's code

### DELETE /api/agents/:agentId
Remove an agent from the database

## Using Custom Agents in Games

In the game creation API, you can now specify custom agents:

```javascript
// When creating a spectator game with custom agents:
POST /api/poker/create
{
  "playerId": "spectator_123",
  "isSpectator": true,
  "aiPlayers": ["custom_agent_id_1", "custom_agent_id_2"]
}
```

The Durable Object will:
1. Check if the agent ID is in the built-in AVAILABLE_OPPONENTS
2. If not, fetch it from D1
3. Cache it in memory for performance
4. Execute it in a sandboxed environment

## Sandboxing Features

The custom agent execution includes:
- ✅ **Timeout protection**: 500ms execution limit per agent decision
- ✅ **Error handling**: Agents that throw errors fall back to "check"
- ✅ **Code validation**: Agents must export proper interface
- ✅ **Data isolation**: GameInfo is deep-copied to prevent mutation
- ✅ **Memory isolation**: Each execution is in a clean function scope
- ✅ **Amount capping**: Raise amounts capped at 1000 chips max

## Schema Details

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,           -- Unique agent identifier
  name TEXT NOT NULL,            -- Human-readable name
  code TEXT NOT NULL,            -- Full agent code as string
  created_at DATETIME,           -- When agent was uploaded
  updated_at DATETIME,           -- Last modification time
  created_by TEXT                -- User who uploaded (optional)
);
```

## Troubleshooting

### "Agent execution timeout"
The agent took too long to make a decision. Simplify your logic.

### "Agent did not export valid object"
Make sure your code exports `exampleOpponent` at the end.

### "Agent missing required methods"
Your agent must have `call()`, `fold()`, and `raise()` methods.

### "D1 database not configured"
Check that your database_id is set correctly in wrangler.jsonc.
