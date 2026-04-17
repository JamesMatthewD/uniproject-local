export async function POST(request) {
  try {
    const { gameId, playerId, action, amount } = await request.json();

    // In production, this would call your Cloudflare Durable Object
    // Example: const durableObject = env.POKER_GAMES.get(new URL(`https://poker/${gameId}`));
    // const result = await durableObject.fetch(request);

    // For now, return a mock response
    const gameState = {
      gameId,
      players: [],
      board: [],
      currentStreet: "pre-flop",
      pot: amount || 0,
      status: "in_progress",
      lastAction: {
        playerId,
        action,
        amount,
      },
    };

    return Response.json({ gameId, gameState });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
