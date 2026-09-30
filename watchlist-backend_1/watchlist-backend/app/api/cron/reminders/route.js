import { Resend } from 'resend';
import { clerkClient } from '@clerk/nextjs/server';
import { getPool } from '../../../../lib/db';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pool = getPool();

  const due = await pool.query(
    `select * from subscriptions
     where status = 'active'
       and renewal_date - (reminder_days_before || ' days')::interval <= now()
       and (last_reminder_sent is null or last_reminder_sent < renewal_date)`
  );

  let sent = 0;

  for (const sub of due.rows) {
    try {
      const user = await clerkClient.users.getUser(sub.user_id);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      await resend.emails.send({
        from: 'Watchlist <onboarding@resend.dev>',
        to: email,
        subject: `${sub.name} charges soon`,
        html: `<p>Heads up — <strong>${sub.name}</strong> (${sub.cost}) is due on ${sub.renewal_date.toISOString().slice(0, 10)}.</p>`,
      });

      await pool.query(`update subscriptions set last_reminder_sent = now() where id = $1`, [sub.id]);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for ${sub.id}:`, err);
    }
  }

  return Response.json({ checked: due.rows.length, sent });
}
