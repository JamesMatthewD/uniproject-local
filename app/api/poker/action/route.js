export async function POST(request) {
  try {
    const { gameId, playerId, action, amount } = await request.json();

    // Forward to Durable Object running on localhost:8787
    const durableObjectUrl = `http://localhost:8787/poker/${gameId}`;
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/action",
          playerId,
          action,
          amount,
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
          players: [],
          board: [],
          currentStreet: "pre-flop",
          pot: amount || 0,
          status: "in_progress",
          lastAction: { playerId, action, amount },
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
