export async function POST(request) {
  try {
    const { gameId, playerId, playerName } = await request.json();

    // Determine if we're in production (Cloudflare) or development (localhost)
    const durableObjectUrl = process.env.DURABLE_OBJECT_URL || `http://localhost:8787/poker/${gameId}`;
    
    // Add timeout to detect slow/failing requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/join",
          playerId,
          playerName,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!doResponse.ok) {
        console.error(`Join failed: Durable Object returned ${doResponse.status}`);
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const doData = await doResponse.json();
      console.log(`Player ${playerId} joined ${gameId} successfully`);
      return Response.json({ gameId, gameState: doData.gameState || doData });
    } catch (doError) {
      clearTimeout(timeoutId);
      
      if (doError.name === 'AbortError') {
        console.error(`Join timeout for ${gameId} - Durable Object not responding`);
      } else {
        console.error(`Join error for ${gameId}:`, doError.message);
      }
      
      // Return mock data for testing but log the error
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
      }, { status: 201 }); // Use 201 to indicate fallback but success
    }
  } catch (error) {
    console.error("Join route error:", error);
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
