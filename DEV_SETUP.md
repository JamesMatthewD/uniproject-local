# Local Development Setup

This project has two separate development servers:

## Quick Start

### 1. Next.js App (Main Frontend)
```bash
npm run dev
```
- Opens on **http://localhost:3000**
- All poker API routes return mock data
- No external dependencies needed

### 2. Durable Object Worker (Separate Terminal)
```bash
cd durable-object/durable-object-starter
npm run dev
```
- Opens on **http://localhost:8787**
- Durable Object worker is ready to handle production requests
- Optional for local development (mocks work fine)

## Testing Locally

**UI Testing (doesn't require Durable Object server):**
1. Run `npm run dev` in the main directory
2. Open http://localhost:3000
3. Navigate to the multiplayer page (`/multiplayer`)
4. All game actions work with mock data

**Full Stack Testing (optional - requires both servers):**
1. Run both dev servers (see above)
2. The multiplayer page will work with full game logic
3. Updates broadcast to all connected players in real-time

## Environment

### Development
- API routes return mock game state
- Game logic is in the Durable Object (`durable-object/durable-object-starter/src/durableObject.js`)
- No authentication or persistence in mock mode

### Production
- Deploy Durable Objects: `cd durable-object/durable-object-starter && npm run deploy`
- Next.js app uses real Durable Object endpoint
- Full multiplayer with persistent state

## Project Structure

```
uniproject-local/
├── app/                           # Next.js frontend
│   ├── page.js                   # Main page with split button
│   ├── ingame/                   # Single-player vs AI
│   ├── multiplayer/              # Multiplayer game (uses mock API)
│   └── api/poker/                # Mock API endpoints
│
└── durable-object/               # Separate Wrangler project
    └── durable-object-starter/
        ├── src/
        │   ├── index.js          # Worker entry point
        │   └── durableObject.js  # PokerGame class (real logic)
        └── wrangler.jsonc        # Cloudflare config
```

## Building for Production

```bash
npm run build
```

This builds the Next.js app. The Durable Objects are deployed separately:

```bash
cd durable-object/durable-object-starter
npm run deploy
```

## Troubleshooting

**"Cannot find module '@/durable-objects/PokerGame'"**
- This is expected in development - the mock API is used instead
- This will work in production when deployed to Cloudflare

**Multiplayer not syncing**
- Ensure both dev servers are running
- Check browser console for connection errors
- Verify wrangler.toml has correct `POKER_GAME` binding

**Port already in use**
- Port 3000: `npm run dev -- -p 3001`
- Port 8787: `cd durable-object/durable-object-starter && npm run dev -- --local-protocol=http -- --port 8788`
