# Multiplayer Texas Hold'Em Setup Guide

This guide explains how to set up the multiplayer poker feature with Cloudflare Durable Objects.

## Overview

The multiplayer poker system is designed to use Cloudflare Durable Objects for real-time, persistent game state management. The architecture includes:

- **Frontend** (`app/multiplayer/page.js`) - React component for the multiplayer UI
- **API Routes** (`app/api/poker/`) - Next.js API endpoints
- **Durable Object** (`src/durableObject.js`) - Cloudflare worker for game logic
- **Existing AI Game** (`app/ingame/page.js`) - Single-player vs AI mode

## Deployment Steps

### 1. Install Cloudflare Workers CLI

```bash
npm install -g @cloudflare/wrangler
```

### 2. Create wrangler.toml Configuration

Add this to your `wrangler.toml` file:

```toml
# ... existing config ...

[durable_objects]
bindings = [
  { name = "POKER_GAMES", class_name = "PokerGame" }
]

[[migrations]]
tag = "v1"
new_classes = ["PokerGame"]
```

### 3. Deploy the Durable Object

```bash
wrangler deploy
```

### 4. Update API Environment

In your `app/api/poker/` routes, update the endpoints to call the Durable Object:

```javascript
// Example for app/api/poker/create/route.js
export async function POST(request) {
  const { playerId, playerName } = await request.json();
  const gameId = `game_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get Durable Object instance
  const durableObject = env.POKER_GAMES.get(new URL(`https://poker/${gameId}`));
  
  // Forward request to Durable Object
  const response = await durableObject.fetch(new Request('https://poker/join', {
    method: 'POST',
    body: JSON.stringify({ playerId, playerName })
  }));
  
  return response;
}
```

## Features

### Multiplayer Mode (`/multiplayer`)
- **Game Codes**: Share game codes with other players to join
- **Real-time Updates**: Uses Durable Objects for instant synchronization
- **Multiple Players**: Support for multiple concurrent games
- **Game Actions**: Fold, Check, Call, Raise, All-in
- **Chip Management**: Track player stacks and pots

### Single-Player Mode (`/ingame`)
- **AI Opponents**: Play against computer-controlled opponents
- **Texas Hold'Em**: Full poker rules implementation
- **Practice**: Perfect for learning the game

### Main Page (`/`)
- **Split Button**: Quick access to both game modes
- **Intuitive UI**: "vs AI" (blue) and "Play Online" (green) sections

## API Endpoints

### `/api/poker/create` - Create a new game
**POST**
```json
{
  "playerId": "player_xxx",
  "playerName": "Player 1"
}
```

### `/api/poker/join` - Join an existing game
**POST**
```json
{
  "gameId": "game_xxx",
  "playerId": "player_yyy",
  "playerName": "Player 2"
}
```

### `/api/poker/action` - Perform a game action
**POST**
```json
{
  "gameId": "game_xxx",
  "playerId": "player_xxx",
  "action": "raise",
  "amount": 100
}
```

## Supported Actions
- `fold` - Fold the current hand
- `check` - Check if no bet is active
- `call` - Match current bet
- `raise` - Raise the bet
- `allin` - Go all-in with remaining chips

## Game States
- `waiting_for_players` - Game created, waiting for more players
- `in_progress` - Game actively being played
- `showdown` - All bets placed, showing hands
- `completed` - Hand finished

## Street Progression
1. `pre-flop` - Initial betting round
2. `flop` - First 3 community cards dealt
3. `turn` - Fourth community card
4. `river` - Fifth community card
5. `final-bet` - Final betting round
6. `showdown` - Compare hands

## Development

### Local Testing (Option 1: Recommended)

The architecture keeps the Durable Objects in a separate project. Here's how to run both dev servers:

**Terminal 1 - Main Next.js App:**
```bash
cd uniproject-local
npm run dev
# Opens on http://localhost:3000
# API routes return mock data
```

**Terminal 2 - Durable Object Dev Server:**
```bash
cd uniproject-local/durable-object/durable-object-starter
npm run dev
# Opens on http://localhost:8787
# Runs the Durable Object worker
```

**How it works:**
- The Next.js app on port 3000 uses **mock data** for all poker API calls during local development
- This allows you to test the UI and game flow without external dependencies
- The Durable Object server on port 8787 is ready for production deployment
- No code changes needed when deploying to Cloudflare - the Durable Objects will automatically replace the mocks

**Testing the multiplayer page locally:**
1. Open http://localhost:3000/multiplayer
2. Create a game and get a game code
3. Share the code with another player
4. Both players can join and see mock game state
5. Actions (fold, check, call, raise) are processed by mock API responses

### Production Deployment

When you're ready to go live:

```bash
cd durable-object/durable-object-starter
npm run deploy
```

This deploys the Durable Object to Cloudflare Workers. Then update your Next.js environment variables to point to the Durable Object endpoint.

### Extending the Implementation

The Durable Object (`durable-object/durable-object-starter/src/durableObject.js`) includes:
- Player management
- Game state tracking
- Hand evaluation logic framework
- WebSocket support for real-time updates

To add features:
1. Extend the `PokerGame` class methods
2. Add new action handlers in `handleAction()`
3. Implement WebSocket listeners for real-time sync

## Troubleshooting

### "Failed to connect to game server"
- Verify Durable Object is deployed
- Check wrangler.toml has correct binding name
- Ensure API routes are forwarding to correct namespace

### Players not seeing same game state
- Verify WebSocket connection is established
- Check `broadcastState()` is called after state changes
- Ensure Durable Object persistence is enabled

## Next Steps

1. **Hand Evaluation**: Implement full poker hand ranking
2. **AI Improvements**: Add smarter AI logic for pre-flop ranges
3. **Animations**: Add card flip and pot animations
4. **Chat**: Add in-game chat functionality
5. **Leaderboards**: Track player statistics across games
