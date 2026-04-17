export async function POST(request) {
  try {
    const { gameId, playerId, playerName } = await request.json();

    // In production, this would call your Cloudflare Durable Object
    // Example: const durableObject = env.POKER_GAMES.get(new URL(`https://poker/${gameId}`));
    // const result = await durableObject.fetch(request);

    // For now, return a mock response
    const gameState = {
      gameId,
      players: [
        {
          id: playerId,
          name: playerName,
          chips: 1000,
          cards: [],
          folded: false,
          isDealer: false,
        },
      ],
      board: [],
      currentStreet: "lobby",
      pot: 0,
      status: "waiting_for_players",
    };

    return Response.json({ gameId, gameState });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
