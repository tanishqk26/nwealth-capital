// ─── Guardrails ────────────────────────────────────────────
// Hard blocks that never reach the LLM. If a message hits a rule,
// return the canned response immediately.

type GuardrailResult = { blocked: true; response: string } | { blocked: false };

const DISCLAIMER =
  '\n\n_Mutual fund investments are subject to market risks. Please read all scheme related documents carefully._';

// Patterns that must never be answered by the bot
const ADVICE_PATTERNS = [
  /which fund (should|to|must|do I)/i,
  /best (mutual fund|fund|sip|scheme)/i,
  /recommend.*(fund|scheme|sip)/i,
  /should i invest/i,
  /where (should|to|must) i invest/i,
  /kaunsa fund (le|kharidu|invest)/i,
  /konsa fund/i,
];

const TRANSACTION_PATTERNS = [
  /\b(redeem|switch|purchase|buy|sell)\b.*\b(fund|unit|folio)\b/i,
  /\bwithdraw\b.*\b(mutual fund|sip)\b/i,
];

const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const PASSWORD_PATTERN = /\b(password|pin|otp)\b.*\b(is|=|:)\b/i;

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'block', 'cancel'];

export function checkGuardrails(text: string): GuardrailResult {
  const lower = text.toLowerCase().trim();

  // Opt-out
  if (OPT_OUT_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + ' '))) {
    return {
      blocked: true,
      response:
        "You've been unsubscribed. You won't receive messages from us. Reply START anytime to opt back in.",
    };
  }

  // PAN or password in chat
  if (PAN_PATTERN.test(text) || PASSWORD_PATTERN.test(lower)) {
    return {
      blocked: true,
      response:
        'For your security, please do not share your PAN, password or OTP here. Our team will contact you through a secure channel.',
    };
  }

  // Personal investment advice
  if (ADVICE_PATTERNS.some((p) => p.test(text))) {
    return {
      blocked: true,
      response:
        'Specific fund recommendations are handled personally by our advisors. Shall I arrange a callback?' +
        DISCLAIMER,
    };
  }

  // Transaction execution
  if (TRANSACTION_PATTERNS.some((p) => p.test(text))) {
    return {
      blocked: true,
      response:
        'Transactions like purchases, redemptions and switches must be done through your advisor or the Investwell portal. Would you like a callback to assist you?',
    };
  }

  return { blocked: false };
}
