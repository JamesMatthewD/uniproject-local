-- D1 Migration: Create agents table for poker agent storage
-- This file can be run via: npx wrangler d1 execute poker_agents < migrations/001_create_agents_table.sql

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);

-- Create table for agent metadata (optional for future use)
CREATE TABLE IF NOT EXISTS agent_metadata (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  description TEXT,
  version INTEGER DEFAULT 1,
  is_public BOOLEAN DEFAULT 0,
  views INTEGER DEFAULT 0,
  rating REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Create index for agent metadata
CREATE INDEX IF NOT EXISTS idx_agent_metadata_agent_id ON agent_metadata(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_user_id ON agent_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_is_public ON agent_metadata(is_public);
