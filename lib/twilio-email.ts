import { appConfig } from "./app-config";
import {
  twilioEmailConfigured,
  twilioEmailFromAddress,
  twilioEmailFromName,
  twilioOAuthClientId,
  twilioOAuthClientSecret,
} from "./twilio-config";
import type { Question, ResponseValue, Survey } from "./types";

/**
 * Optional admin notification when someone completes a survey.
 *
 * Provisioned by `stripe projects add twilio/email`. Projects hands back OAuth
 * client credentials rather than a classic SendGrid API key, so sends exchange
 * those for a short-lived access token first.
 *
 * Every send here is best effort: a failure is logged and swallowed so it can
 * never block or fail a participant's submission.
 */

const TWILIO_TOKEN_URL = "https://oauth.twilio.com/v2/token";
const TWILIO_EMAIL_URL = "https://comms.twilio.com/v1/Emails";
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60_000;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;

  const response = await fetch(TWILIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: twilioOAuthClientId,
      client_secret: twilioOAuthClientSecret,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Twilio token exchange failed with status ${response.status}. ${detail}`.trim(),
    );
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Twilio token exchange did not return an access token.");
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS,
  };
  return cachedToken.accessToken;
}

function formatAnswer(value: ResponseValue): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildContent(
  survey: Survey,
  questions: Question[],
  answers: Record<string, ResponseValue>,
) {
  const answered = questions.filter((q) => answers[q.id] !== undefined);
  const subject = `New response — ${survey.title}`;

  const text = [
    `A new response came in for "${survey.title}".`,
    "",
    ...answered.map((q) => `${q.prompt}\n  ${formatAnswer(answers[q.id])}`),
    "",
    `— ${appConfig.name}`,
  ].join("\n");

  const html = [
    '<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6;">',
    `<h1 style="font-size: 20px; margin: 0 0 16px;">New response — ${survey.title}</h1>`,
    ...answered.map(
      (q) =>
        `<p style="margin: 0 0 14px;"><strong style="display:block; color:#475569; font-size:13px;">${q.prompt}</strong>${formatAnswer(answers[q.id])}</p>`,
    ),
    `<p style="margin: 24px 0 0; color: #64748b;">— ${appConfig.name}</p>`,
    "</div>",
  ].join("");

  return { subject, text, html };
}

/**
 * Notify the survey's admin that a response was submitted. Returns whether a
 * message was actually sent; never throws.
 */
export async function notifyAdminOnSubmit(
  survey: Survey,
  questions: Question[],
  answers: Record<string, ResponseValue>,
): Promise<boolean> {
  if (!survey.notifyOnSubmit || !survey.adminEmail) return false;
  if (!twilioEmailConfigured) return false;

  try {
    const accessToken = await getAccessToken();
    const { subject, text, html } = buildContent(survey, questions, answers);

    const response = await fetch(TWILIO_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: twilioEmailFromAddress, name: twilioEmailFromName },
        to: [{ address: survey.adminEmail }],
        content: { subject, html, text },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Twilio email send failed with status ${response.status}. ${detail}`.trim(),
      );
    }
    return true;
  } catch (error) {
    console.error("Failed to send survey notification via Twilio:", error);
    return false;
  }
}
