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

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		
		// Route to Durable Object
		if (url.pathname.startsWith('/poker')) {
			const gameId = url.pathname.split('/')[2] || 'default';
			const durableObject = env.POKER_GAME.get(gameId);
			return durableObject.fetch(request);
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
