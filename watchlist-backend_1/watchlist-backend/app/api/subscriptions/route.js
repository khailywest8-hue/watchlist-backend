import { auth } from '@clerk/nextjs/server';
import { getPool } from '../../../lib/db';

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return Response.json({ error: 'Not signed in' }, { status: 401 });
  }

  const pool = getPool();
  const result = await pool.query(
    `select * from subscriptions where user_id = $1 and status = 'active' order by renewal_date asc`,
    [userId]
  );
  return Response.json({ subscriptions: result.rows });
}

export async function POST(request) {
  const { userId } = auth();
  if (!userId) {
    return Response.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await request.json();
  const { name, cost, cadence, renewalDate, reminderDaysBefore } = body;

  if (!name || !cost || !renewalDate) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const pool = getPool();
  const result = await pool.query(
    `insert into subscriptions (user_id, name, cost, cadence, renewal_date, reminder_days_before)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [userId, name, cost, cadence || 'monthly', renewalDate, reminderDaysBefore || 3]
  );

  return Response.json({ subscription: result.rows[0] }, { status: 201 });
}
