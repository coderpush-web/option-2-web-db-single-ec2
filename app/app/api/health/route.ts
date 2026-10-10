export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
