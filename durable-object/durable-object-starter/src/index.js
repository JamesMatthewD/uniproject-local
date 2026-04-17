/**
 * Cloudflare Durable Object Worker
 * 
 * This worker handles routing to the PokerGame Durable Object.
 * Durable Objects provide persistent state and real-time features for multiplayer poker.
 *
 * Development:
 * - Run `npm run dev` to start the Durable Object dev server (port 8787)
 * - The main Next.js app runs on port 3000
 * 
 * Production:
 * - Run `npm run deploy` to publish to Cloudflare Workers
 */

import { PokerGame } from './durableObject';

export { PokerGame };

// Store games in memory for local development
// In production, Durable Objects will provide persistence
const games = new Map();

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		
		// List available games (not full)
		if (url.pathname === '/available-games' && request.method === 'GET') {
			const availableGames = [];
			const POKER_TABLE_SEATS = 6;
			
			for (const [gameId, game] of games.entries()) {
				const gameState = game.getGameState?.();
				if (gameState) {
					const playerCount = gameState.players?.length || 0;
					if (playerCount < POKER_TABLE_SEATS) {
						availableGames.push({
							gameId,
							playerCount,
							maxSeats: POKER_TABLE_SEATS,
							status: gameState.status,
						});
					}
				}
			}
			
			return new Response(JSON.stringify({ games: availableGames }), {
				headers: { "Content-Type": "application/json" },
			});
		}
		
		// Route to Durable Object
		if (url.pathname.startsWith('/poker')) {
			const gameId = url.pathname.split('/')[2] || 'default';
			
			// Get or create game instance
			if (!games.has(gameId)) {
				games.set(gameId, new PokerGame({}, env));
			}
			
			const game = games.get(gameId);
			return game.fetch(request);
		}
		
		// Default routes for testing
		switch (url.pathname) {
			case '/message':
				return new Response('Hello, World!');
			case '/random':
				return new Response(crypto.randomUUID());
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
};
