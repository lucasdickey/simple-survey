import type { ResponseValue } from "./types";

/**
 * Deterministic PII redaction applied to free-form text (interview transcripts
 * and open-text answers) BEFORE it is persisted to the analytics database, so
 * structured PII never lands on disk there.
 *
 * This is the regex tier: it reliably catches structured identifiers — email,
 * phone, US SSN, payment-card numbers, and linked URLs. It deliberately does
 * NOT attempt free-form names or company names (those would need an NER/LLM
 * pass). Redaction is one-way by design.
 *
 * Opt-in follow-up emails live in the separate contacts database (captured via
 * the Start form), not in answers — so this never affects the ability to follow
 * up. An email volunteered mid-answer is intentionally dropped (it was never
 * consented for outreach).
 */

// Applied in order. Earlier patterns win, so anything email- or URL-shaped is
// removed before the broader numeric (card/phone) patterns run.
const PATTERNS: Array<[RegExp, string]> = [
  // Email addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]"],
  // Linked URLs (http(s):// or www.). Bare domain mentions like "cursor.com"
  // are intentionally kept so tool references stay analyzable.
  [/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi, "[URL]"],
  // US Social Security numbers.
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]"],
  // Payment cards: 4-4-4-(1..4) or Amex 4-6-5, with space/dash separators...
  [/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}\b/g, "[CARD]"],
  [/\b\d{4}[ -]\d{6}[ -]\d{5}\b/g, "[CARD]"],
  // ...or 13–16 contiguous digits.
  [/\b\d{13,16}\b/g, "[CARD]"],
  // Phone numbers: 10–11 digits in common groupings (runs after card patterns
  // so it can't nibble the front of a longer card number).
  [/(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, "[PHONE]"],
];

/** Redact structured PII from a free-form string. */
export function redactPII(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  return out;
}

/** Redact a stored response value: scrub strings (and string arrays); leave numbers. */
export function redactValue(value: ResponseValue): ResponseValue {
  if (typeof value === "string") return redactPII(value);
  if (Array.isArray(value)) return value.map((v) => redactPII(v));
  return value;
}
