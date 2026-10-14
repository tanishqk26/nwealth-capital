// Starts the reminder scheduler once per server process (long-running Node server: dev, VPS).
// On serverless hosts there is no persistent process — call GET /api/cron/reminders from a cron instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as { __nwealthReminderTimer?: ReturnType<typeof setInterval> };
  if (g.__nwealthReminderTimer) return;

  const { runDueReminders } = await import('./lib/reminders');
  g.__nwealthReminderTimer = setInterval(() => {
    runDueReminders().catch((err) => console.error('[reminders] tick failed:', err));
  }, 30_000);
}
