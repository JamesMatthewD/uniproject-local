export async function POST(request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return Response.json(
        { error: "gameId required" },
        { status: 400 }
      );
    }

    // Determine if we're in production (Cloudflare) or development (localhost)
    const durableObjectUrl = process.env.DURABLE_OBJECT_URL || `http://localhost:8787/poker/${gameId}`;
    
    // Add timeout to detect slow/failing requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!doResponse.ok) {
        console.error(`Durable Object returned status ${doResponse.status}`);
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const doData = await doResponse.json();
      
      // Log successful response
      console.log(`State fetch successful for ${gameId}:`, doData?.gameState?.players?.length || 0, "players");
      
      return Response.json({ gameState: doData.gameState || doData });
    } catch (doError) {
      clearTimeout(timeoutId);
      
      // Log the specific error
      if (doError.name === 'AbortError') {
        console.error(`Durable Object request timeout for ${gameId}`);
      } else {
        console.error(`Durable Object error for ${gameId}:`, doError.message);
      }
      
      // Return status code for client to handle retry
      // This signals an error without losing state on the client
      return Response.json(
        {
          error: "Durable Object unavailable",
          gameState: null, // Let client keep previous state
        },
        { status: 503 } // Service Unavailable - client knows to retry
      );
    }
  } catch (error) {
    console.error("State route error:", error);
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
