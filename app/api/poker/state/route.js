export async function POST(request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return Response.json(
        { error: "gameId required" },
        { status: 400 }
      );
    }

    // Forward to Durable Object running on localhost:8787
    const durableObjectUrl = `http://localhost:8787/poker/${gameId}`;
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!doResponse.ok) {
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const doData = await doResponse.json();
      return Response.json({ gameState: doData.gameState || doData });
    } catch (doError) {
      console.error("Failed to get state from Durable Object:", doError);
      // Return empty state if Durable Object unavailable
      return Response.json({
        gameState: {
          players: [],
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
