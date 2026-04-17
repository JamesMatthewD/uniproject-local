// API endpoint to save custom agents to D1 database via Durable Object
// POST /api/agents/save

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, code } = body;

    // Validation
    if (!name || typeof name !== "string") {
      return Response.json(
        { error: "Missing or invalid agent name" },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string") {
      return Response.json(
        { error: "Missing or invalid agent code" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      return Response.json(
        { error: "Agent name cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return Response.json(
        { error: "Agent name too long (max 100 characters)" },
        { status: 400 }
      );
    }

    if (trimmedCode.length === 0) {
      return Response.json(
        { error: "Agent code cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedCode.length > 50000) {
      return Response.json(
        { error: "Agent code too large (max 50KB)" },
        { status: 400 }
      );
    }

    // Validate that code contains required exports
    if (!trimmedCode.includes("exampleOpponent")) {
      return Response.json(
        { error: "Agent must export 'exampleOpponent' object" },
        { status: 400 }
      );
    }

    // Check for required functions with regex patterns
    const hasCall = /call\s*:\s*\(|\.call\s*=|call\s*\(/m.test(trimmedCode);
    const hasFold = /fold\s*:\s*\(|\.fold\s*=|fold\s*\(/m.test(trimmedCode);
    const hasRaise = /raise\s*:\s*\(|\.raise\s*=|raise\s*\(/m.test(trimmedCode);

    if (!hasCall || !hasFold || !hasRaise) {
      return Response.json(
        { error: "Agent must have call(), fold(), and raise() methods" },
        { status: 400 }
      );
    }

    // Attempt to parse the code (basic check)
    try {
      // Remove export keyword to make it compatible with new Function()
      const codeWithoutExport = trimmedCode
        .replace(/^\s*export\s+default\s+/m, "")
        .replace(/^\s*export\s+(const|let|var|function)\s+/m, "$1 ");

      const testFunc = new Function(`
        ${codeWithoutExport}
        if (!exampleOpponent) throw new Error("exampleOpponent is required");
        if (typeof exampleOpponent !== "object") throw new Error("exampleOpponent must be an object");
        return true;
      `);
      testFunc();
    } catch (parseError) {
      return Response.json(
        { error: `Invalid agent code: ${parseError.message}` },
        { status: 400 }
      );
    }

    // Generate agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return Response.json({
      success: true,
      message: "Agent uploaded successfully",
      agentId: agentId,
      agentName: trimmedName,
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
