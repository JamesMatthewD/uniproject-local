export async function POST(request) {
  try {
    const { gameId, playerId, action, amount } = await request.json();

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
          path: "/action",
          playerId,
          action,
          amount,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!doResponse.ok) {
        console.error(`Action failed: Durable Object returned ${doResponse.status}`);
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const doData = await doResponse.json();
      console.log(`Player ${playerId} performed ${action} in ${gameId}`);
      return Response.json({ gameId, gameState: doData.gameState || doData });
    } catch (doError) {
      clearTimeout(timeoutId);
      
      if (doError.name === 'AbortError') {
        console.error(`Action timeout for ${gameId} - Durable Object not responding`);
      } else {
        console.error(`Action error for ${gameId}:`, doError.message);
      }
      
      // Return error status so client can retry
      return Response.json(
        { error: "Durable Object unavailable" },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Action route error:", error);
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
