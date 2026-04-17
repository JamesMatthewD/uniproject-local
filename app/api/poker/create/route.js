export async function POST(request) {
  try {
    const { playerId, playerName } = await request.json();

    // Generate a unique game ID
    const gameId = `game_${Math.random().toString(36).substr(2, 9)}`;

    // In production, this would call your Cloudflare Durable Object
    // Example: const durableObject = env.POKER_GAMES.get(new URL(`https://poker/${gameId}`));
    // For now, we'll return a response structure

    const gameState = {
      gameId,
      players: [
        {
          id: playerId,
          name: playerName,
          chips: 1000,
          cards: [],
          folded: false,
          isDealer: true,
        },
      ],
      board: [],
      currentStreet: "lobby",
      pot: 0,
      status: "waiting_for_players",
      createdAt: new Date().toISOString(),
    };

    return Response.json({ gameId, gameState });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
