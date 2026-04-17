// API endpoint to list all agents from D1 database
// GET /api/agents/list

export async function GET(request) {
  try {
    // For now, return empty list - in production, this would query D1
    // When D1 binding is configured, fetch agents like:
    // const db = request.cf.env.DB;
    // const agents = await db.prepare("SELECT * FROM agents").all();
    
    // This is a placeholder that returns an empty list
    // Agents uploaded locally in this session will be passed from client
    return Response.json({
      agents: [],
      message: "Database agents would appear here when D1 is configured"
    });
  } catch (error) {
    console.error("List agents error:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
