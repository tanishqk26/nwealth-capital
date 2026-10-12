import { GoogleGenerativeAI, SchemaType, type Content } from '@google/generative-ai';
import { db, getRecentMessages, type Message } from './supabase';
import { checkGuardrails } from './guardrails';
import { searchFAQ } from './rag';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are the Nwealth Capital WhatsApp AI assistant. Nwealth Capital is a SEBI-registered mutual fund distributor based in Pune, India.

YOUR ROLE:
- Answer general questions about mutual fund investments: SIPs, lump-sum, portfolio tracking, KYC
- Help clients book callbacks with the sales team
- Capture investment enquiries (new leads)
- Guide clients to share their CAS statement (Consolidated Account Statement)
- Provide information about investor awareness events
- Handle opt-in / opt-out requests

LANGUAGE: Detect whether the user writes in English, Hindi (Devanagari or Roman), or Hinglish, and always reply in the same language/style. If Hindi: use simple, conversational Hindi. If Hinglish: match their tone.

STRICT RULES (never break these):
1. NEVER give personal investment advice or recommend specific mutual fund schemes
2. NEVER help execute transactions (purchase, switch, redeem, withdraw)
3. NEVER collect PAN numbers, Aadhaar, passwords, or OTPs in the chat
4. NEVER predict markets or guarantee returns
5. When unsure, always use the handoff_to_human tool

DISCLAIMER (add when discussing investment amounts or products):
"Mutual fund investments are subject to market risks. Please read all scheme related documents carefully."

TOOLS — use them when appropriate:
- create_lead: user shows investment interest and shares amount/timing
- request_callback: user asks to speak to someone or confirms they want a call
- handoff_to_human: complex, personal, or out-of-scope queries
- register_event: user wants to attend an investor awareness event
- record_opt_out: user sends STOP, Unsubscribe, or similar

Keep responses concise (2–4 lines). Be warm, helpful, and professional.`;

// ─── Tool declarations ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: 'create_lead',
        description: 'Create a lead when the user shows investment interest.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            intent: { type: SchemaType.STRING, description: 'Investment intent or goal' },
            amount_range: { type: SchemaType.STRING, description: 'Estimated monthly/lump-sum amount' },
            callback_time: { type: SchemaType.STRING, description: 'Preferred callback time if mentioned' },
          },
          required: ['intent'],
        },
      },
      {
        name: 'request_callback',
        description: 'Log a callback request from the client.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            time_preference: {
              type: SchemaType.STRING,
              description: 'morning (10–12) | afternoon (12–4) | evening (4–7)',
            },
          },
          required: ['time_preference'],
        },
      },
      {
        name: 'handoff_to_human',
        description: 'Hand off the conversation to a human agent.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            reason: { type: SchemaType.STRING, description: 'Why human handoff is needed' },
            summary: { type: SchemaType.STRING, description: 'Brief conversation summary for the agent' },
          },
          required: ['reason', 'summary'],
        },
      },
      {
        name: 'register_event',
        description: 'Register the client for an investor awareness event.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: 'Client name' },
            society: { type: SchemaType.STRING, description: 'Society or locality name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'record_opt_out',
        description: 'Record that the user wants to stop receiving messages.',
        parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
      },
    ],
  },
];

// ─── Tool executor ──────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, string>,
  conversationId: string,
  contactId: string
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'create_lead':
        await db.from('leads').insert({
          contact_id: contactId,
          conversation_id: conversationId,
          intent: args.intent,
          amount_range: args.amount_range ?? null,
          callback_time: args.callback_time ?? null,
          status: 'new',
        });
        return { success: true, message: 'Lead captured' };

      case 'request_callback':
        await db.from('leads').insert({
          contact_id: contactId,
          conversation_id: conversationId,
          intent: 'callback',
          callback_time: args.time_preference,
          status: 'new',
        });
        return { success: true, message: 'Callback scheduled' };

      case 'handoff_to_human':
        await db.from('conversations').update({ status: 'handoff' }).eq('id', conversationId);
        return { success: true, message: 'Conversation flagged for human handoff' };

      case 'register_event':
        await db.from('leads').insert({
          contact_id: contactId,
          conversation_id: conversationId,
          intent: `event_registration: ${args.society ?? 'unknown society'}`,
          status: 'new',
        });
        return { success: true, message: 'Event registration noted' };

      case 'record_opt_out':
        // Simple implementation — extend with an opt_outs table later
        await db.from('conversations').update({ status: 'closed' }).eq('id', conversationId);
        return { success: true, message: 'Opt-out recorded' };

      default:
        return { success: false, message: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[agent] tool ${name} failed:`, err);
    return { success: false, message: String(err) };
  }
}

// ─── History builder ────────────────────────────────────────
function buildHistory(messages: Message[]): Content[] {
  const history: Content[] = [];
  for (const msg of messages) {
    // Gemini history must alternate user / model and cannot end with model.
    // We pass everything except the last user message (which goes in sendMessage).
    history.push({
      role: msg.direction === 'inbound' ? 'user' : 'model',
      parts: [{ text: msg.body }],
    });
  }
  return history;
}

// ─── Main entry point ───────────────────────────────────────
export async function processMessage(
  conversationId: string,
  contactId: string,
  userText: string
): Promise<string> {
  // 1. Hard guardrail check (never reaches LLM)
  const guard = checkGuardrails(userText);
  if (guard.blocked) return guard.response;

  // 2. Load conversation history (exclude the message just received)
  const recentMessages = await getRecentMessages(conversationId, 18);
  // Build history from all previous messages (current user message not yet saved)
  const historyMessages = recentMessages.filter((m) => !(m.direction === 'inbound' && m.body === userText));
  const history = buildHistory(historyMessages);

  // 3. RAG: search Pinecone for relevant FAQ chunks and inject as context
  let messageWithContext = userText;
  try {
    const ragChunks = await searchFAQ(userText, 4);
    if (ragChunks.length > 0) {
      messageWithContext =
        `[Relevant knowledge from Nwealth FAQ database]\n${ragChunks.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n[User message]\n${userText}`;
    }
  } catch {
    // RAG failure is non-fatal — continue without context
  }

  // 4. Call Gemini
  const model = genai.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    tools: TOOLS,
  });

  const chat = model.startChat({ history });

  try {
    let result = await chat.sendMessage(messageWithContext);

    // Tool-use loop (Gemini may call multiple tools)
    let iterations = 0;
    while (result.response.functionCalls()?.length && iterations < 5) {
      iterations++;
      const calls = result.response.functionCalls()!;

      const toolResults = await Promise.all(
        calls.map(async (fc) => {
          const output = await executeTool(
            fc.name,
            fc.args as Record<string, string>,
            conversationId,
            contactId
          );
          return {
            functionResponse: {
              name: fc.name,
              response: output,
            },
          };
        })
      );

      result = await chat.sendMessage(toolResults);
    }

    return result.response.text();
  } catch (err) {
    console.error('[agent] Gemini error:', err);
    return "I'm having trouble right now. Please try again in a moment or type 'human' to speak with our team.";
  }
}
