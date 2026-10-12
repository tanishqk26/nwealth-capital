// ─── Zaple transport adapter ───────────────────────────────
// Activated when TRANSPORT=zaple in .env.local.
// Zaple docs: https://zaple.ai/docs/
// Auth: Zaple-Api-Key + Zaple-Api-Secret headers
// Send endpoint: POST https://app.zaple.ai/api/v3/send-template-message

import type { IMessageTransport, OutboundMessage } from './types';

const ZAPLE_BASE = 'https://app.zaple.ai';

export class ZapleTransport implements IMessageTransport {
  readonly name = 'zaple';

  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.apiKey = process.env.ZAPLE_API_KEY ?? '';
    this.apiSecret = process.env.ZAPLE_API_SECRET ?? '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('[ZapleTransport] ZAPLE_API_KEY / ZAPLE_API_SECRET not set — sends will fail.');
    }
  }

  async send(message: OutboundMessage): Promise<void> {
    // Zaple v3 uses JSON body for text messages sent outside the 24-hour window
    // (requires an approved template). For free-form replies within the window,
    // use the service message endpoint. Adjust as needed once Zaple access is confirmed.
    const res = await fetch(`${ZAPLE_BASE}/api/v3/send-template-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Zaple-Api-Key': this.apiKey,
        'Zaple-Api-Secret': this.apiSecret,
      },
      body: JSON.stringify({
        send_to: message.to,
        country_code: '91',
        // TODO: replace with an approved template_id when available
        // For free-form replies you'll use the service messages API instead
        body: message.body,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[ZapleTransport] send failed (${res.status}): ${text}`);
    }
  }

  // ── Inbound webhook normalizer ────────────────────────────
  // Zaple POSTs inbound messages to your configured webhook URL.
  // The full payload schema is documented inside the Zaple dashboard
  // (Settings → Webhooks). Map fields here once you have access.
  static normalizeWebhook(payload: Record<string, unknown>): {
    phone: string;
    name: string;
    text: string;
    messageId: string;
  } {
    // TODO: confirm exact field names from Zaple webhook payload
    return {
      phone: String(payload.from ?? payload.phone ?? ''),
      name: String(payload.contact_name ?? payload.name ?? ''),
      text: String(payload.text ?? payload.message ?? ''),
      messageId: String(payload.message_id ?? payload.id ?? ''),
    };
  }
}
