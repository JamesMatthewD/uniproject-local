export async function POST(request) {
  try {
    const { gameId, playerId, playerName } = await request.json();

    // Determine if we're in production (Cloudflare) or development (localhost)
    const durableObjectUrl = process.env.DURABLE_OBJECT_URL || `http://localhost:8787/poker/${gameId}`;
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/join",
          playerId,
          playerName,
        }),
      });
      
      if (!doResponse.ok) {
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const doData = await doResponse.json();
      return Response.json({ gameId, gameState: doData.gameState || doData });
    } catch (doError) {
      console.error("Failed to connect to Durable Object:", doError);
      console.log("Falling back to mock data - is Durable Object running on 8787?");
      return Response.json({
        gameId,
        gameState: {
          gameId,
          players: [
            {
              id: playerId,
              name: playerName,
              chips: 1000,
              cards: [],
              folded: false,
            },
          ],
          board: [],
          currentStreet: "lobby",
          pot: 0,
          status: "waiting_for_players",
          handNumber: 0,
        },
      });
    }
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
