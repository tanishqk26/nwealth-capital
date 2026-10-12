// ─── Transport abstraction ─────────────────────────────────
// All message channels (local dev UI, Zaple, future BSPs) implement this interface.
// Switching from local UI to Zaple = change TRANSPORT env var, zero AI-layer changes.

export type InboundMessage = {
  messageId: string;      // Unique message ID (wa_message_id in production)
  conversationId: string; // Our internal conversation ID
  contactId: string;      // Our internal contact ID
  phone: string;          // Sender phone (e.g. "919876543210")
  name: string;           // Sender display name
  text: string;           // Message text
  timestamp: string;      // ISO timestamp
};

export type OutboundMessage = {
  to: string;             // Recipient phone or conversationId
  body: string;           // Text to send
  type: 'text';
};

export interface IMessageTransport {
  send(message: OutboundMessage): Promise<void>;
  name: string;
}
