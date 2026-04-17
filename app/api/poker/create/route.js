export async function POST(request) {
  try {
    const { playerId, playerName } = await request.json();
    const gameId = `game_${Math.random().toString(36).substr(2, 9)}`;

    // Forward to Durable Object running on localhost:8787
    const durableObjectUrl = `http://localhost:8787/poker/${gameId}`;
    
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
      
      // Return with gameId for client reference
      return Response.json({ 
        gameId, 
        gameState: doData.gameState || doData 
      });
    } catch (doError) {
      console.error("Failed to connect to Durable Object:", doError);
      // Return mock data if Durable Object unavailable
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
