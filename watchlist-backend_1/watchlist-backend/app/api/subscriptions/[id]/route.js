import { auth } from '@clerk/nextjs/server';
import { getPool } from '../../../../lib/db';

export async function PATCH(request, { params }) {
  const { userId } = auth();
  if (!userId) {
    return Response.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { action } = await request.json();
  const pool = getPool();

  if (action === 'snooze') {
    await pool.query(
      `update subscriptions
       set renewal_date = case
         when cadence = 'yearly' then renewal_date + interval '1 year'
         else renewal_date + interval '1 month'
       end,
       last_reminder_sent = null
       where id = $1 and user_id = $2`,
      [params.id, userId]
    );
  } else if (action === 'cancel') {
    await pool.query(
      `update subscriptions set status = 'cancelled' where id = $1 and user_id = $2`,
      [params.id, userId]
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { userId } = auth();
  if (!userId) {
    return Response.json({ error: 'Not signed in' }, { status: 401 });
  }

  const pool = getPool();
  await pool.query(`delete from subscriptions where id = $1 and user_id = $2`, [params.id, userId]);

  return Response.json({ ok: true });
}
