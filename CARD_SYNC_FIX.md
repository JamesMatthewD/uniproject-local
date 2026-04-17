# Card Images & Game State Sync Fix

## Summary of Changes

This update fixes two critical issues:
1. **Card image rendering** - Cards now display as PNG images instead of text (A-H, K-D, etc.)
2. **Second client sync** - Both players now receive game state updates via polling

## What Was Changed

### 1. **Card Image Display** (`app/multiplayer/page.js`)
- Added `getCardImagePath(card)` function to convert card format:
  - Input: "A-H" (Ace of Hearts)
  - Output: `/cards/ace_of_hearts.png`
- Added `CardImage` React component with:
  - Image rendering with proper sizes (small/medium/large)
  - Fallback placeholder for hidden/missing cards
  - Error handling for missing image files
- Updated community cards display to use `<CardImage>` component
- Updated player cards display to use `<CardImage>` with hidden state for opponents

### 2. **Game State Polling** (`app/multiplayer/page.js`)
- Added polling mechanism that fetches game state every 500ms
- Only active when a game is in progress
- Calls new `/api/poker/state` endpoint
- Ensures both players always see the latest game state

### 3. **New API Endpoint** (`app/api/poker/state/route.js`)
- New GET endpoint at `/api/poker/state`
- Accepts `gameId` in request body
- Forwards to Durable Object and returns current game state
- Gracefully handles Durable Object unavailability

### 4. **Durable Object Enhancement** (`durableObject.js`)
- Added `handleGetState()` method to return current game state
- Updated `fetch()` method to handle GET requests
- Both players can independently query current game state

### 5. **Styling** (`app/globals.css`)
- Added `.card-placeholder` class for hidden/empty card slots
- Added `.cards-display` layout styles for community cards
- Added comprehensive multiplayer poker table styles
- Added player seat and card positioning styles

## How It Works

### Card Rendering Flow
1. Game deals cards to players (stored as "A-H", "K-D", etc.)
2. `CardImage` component receives card code
3. `getCardImagePath()` converts to filename: "ace_of_hearts.png"
4. Image loads from `/public/cards/` directory
5. Falls back to placeholder "?" if image missing

### Game State Sync Flow
1. Player creates/joins game
2. API responds with initial game state
3. Polling loop starts (every 500ms)
4. Each poll calls `/api/poker/state`
5. Endpoint queries Durable Object on localhost:8787
6. Game state updates in UI for all players

## Testing Instructions

### Prerequisites
- Both dev servers running:
  ```bash
  npm run dev           # Terminal 1, port 3000
  npm run wrangler dev  # Terminal 2, port 8787
  ```

### Test Case 1: Card Image Rendering
1. Open multiplayer page
2. Create a game
3. Wait for hand to deal (2+ players)
4. Should see card images, not text
5. Hover over community cards to see close-up

### Test Case 2: Two Client Sync
1. Open multiplayer in two browser windows/tabs
2. First tab: Create game, copy code
3. Second tab: Join game with code
4. Both tabs should show:
   - Same player list
   - Same chip counts
   - Same dealt cards (when hand is dealt)
5. Both tabs should receive game state updates every 500ms

### Test Case 3: Hand Dealing
1. Two clients in game
2. Should auto-deal after 2 players present
3. Both see flop, turn, river cards
4. Hand auto-redeals after 3 seconds

### Test Case 4: Error Handling
1. Stop Wrangler (Durable Object)
2. Try to create/join game
3. Should fallback gracefully
4. Restart Wrangler
5. Game should work again

## Card Naming Reference

If images aren't showing, verify `/public/cards/` contains:
- **Ranks**: `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `jack`, `queen`, `king`, `ace`
- **Suits**: `hearts`, `diamonds`, `clubs`, `spades`
- **Format**: `{rank}_of_{suit}.png`

Examples:
- `ace_of_hearts.png` ✓
- `10_of_spades.png` ✓
- `queen_of_clubs.png` ✓
- `2_of_diamonds.png` ✓

## Troubleshooting

### Images showing as placeholders "?"
- Check `/public/cards/` directory has PNG files
- Verify filenames match format exactly
- Restart Next.js dev server (`npm run dev`)
- Check browser console for 404 errors

### Second client not updating
- Verify both servers running (port 3000 + 8787)
- Check browser console for fetch errors
- Confirm polling is active (check network tab)
- May need to refresh page

### Cards displaying as text
- This is fallback behavior when images unavailable
- Check card files exist in `/public/cards/`
- Verify CardImage component loaded
- Check `getCardImagePath()` function converting correctly

## Files Modified
- `app/multiplayer/page.js` - Card display + polling
- `app/api/poker/state/route.js` - New endpoint (created)
- `durable-object/durable-object-starter/src/durableObject.js` - GET state handler
- `app/globals.css` - Multiplayer styles

## Next Steps (Optional)
- Implement hand evaluation logic to determine winner
- Add betting round progression through streets
- Integrate AI opponent
- Add chat functionality
- Persist game state to durable storage
