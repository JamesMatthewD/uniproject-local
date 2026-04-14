export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return Response.json({
    received: body,
    message: "Echo from Next.js API route"
  });
}
