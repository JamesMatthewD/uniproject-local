export async function GET(request) {
  try {
    // Forward to Durable Object to get list of available games
    const durableObjectUrl = `http://localhost:8787/available-games`;
    
    try {
      const doResponse = await fetch(durableObjectUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!doResponse.ok) {
        throw new Error(`Durable Object error: ${doResponse.status}`);
      }

      const data = await doResponse.json();
      return Response.json({ games: data.games || [] });
    } catch (doError) {
      console.error("Failed to get available games from Durable Object:", doError);
      // Return empty list if Durable Object unavailable
      return Response.json({ games: [] });
    }
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
