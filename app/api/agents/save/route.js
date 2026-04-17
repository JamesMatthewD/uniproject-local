// API endpoint to save custom agents to D1 database via Durable Object
// POST /api/agents/save

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, code } = body;

    // Validation
    if (!name || !code) {
      return Response.json(
        { error: "Missing required fields: name, code" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return Response.json(
        { error: "Agent name too long (max 100 characters)" },
        { status: 400 }
      );
    }

    if (code.length > 50000) {
      return Response.json(
        { error: "Agent code too large (max 50KB)" },
        { status: 400 }
      );
    }

    // Validate that code contains required exports
    if (!code.includes("exampleOpponent")) {
      return Response.json(
        { error: "Code must export 'exampleOpponent' object" },
        { status: 400 }
      );
    }

    if (!code.includes(".call") || !code.includes(".fold") || !code.includes(".raise")) {
      return Response.json(
        { error: "Agent must have call(), fold(), and raise() methods" },
        { status: 400 }
      );
    }

    // Get the Durable Object namespace from env
    // This will be available through Cloudflare's context
    // For now, return success with a generated ID
    // In production with proper service binding setup, this would call the DO
    
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return Response.json({
      success: true,
      message: "Agent uploaded successfully",
      agentId: agentId,
      agentName: name,
      note: "Agent ID generated. Configure D1 service binding to persist to database."
    });
  } catch (error) {
    console.error("Agent save error:", error);
    return Response.json(
      { error: "Failed to save agent: " + error.message },
      { status: 500 }
    );
  }
}
