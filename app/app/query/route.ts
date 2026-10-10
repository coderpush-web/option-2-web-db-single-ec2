import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function listInvoices() {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { message: 'Query endpoint is disabled in production' },
      { status: 403 }
    );
  }

  try {
    return Response.json(await listInvoices());
  } catch (error) {
    console.error('Database query error:', error);
    return Response.json({ message: 'Failed to query database' }, { status: 500 });
  }
}
