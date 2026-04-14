export async function GET() {
  return Response.json({
    ok: true,
    service: "uniproject-api",
    timestamp: new Date().toISOString()
  });
}
