import { initDatabase } from '../lib/db';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { message: 'Seed endpoint is disabled in production' },
      { status: 403 }
    );
  }

  try {
    initDatabase();
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Database seed error:', error);
    return Response.json({ message: 'Failed to seed database' }, { status: 500 });
  }
}
