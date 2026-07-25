"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ATTRIBUTION_COOKIE, UTM_KEYS } from "@/lib/attribution";

/**
 * Entry point for a participant. Email is genuinely optional — leaving it blank
 * keeps the response anonymous, and when it is supplied it goes only to the
 * contacts database, never alongside the answers.
 */
export function StartForm({
  surveyId,
  collectsEmail,
}: {
  surveyId: string;
  collectsEmail: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First-touch attribution: written once and never overwritten, so a
  // participant who arrives via a campaign and returns directly still counts
  // against the campaign.
  useEffect(() => {
    if (document.cookie.includes(`${ATTRIBUTION_COOKIE}=`)) return;

    const params = new URLSearchParams(window.location.search);
    const payload: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) payload[key] = value;
    }
    if (document.referrer) payload.referrer = document.referrer;
    if (Object.keys(payload).length === 0) return;

    const value = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${ATTRIBUTION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/surveys/${surveyId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collectsEmail ? email : "" }),
      });
      const data = (await response.json()) as { participantId?: string; error?: string };

      if (!response.ok || !data.participantId) {
        setError(data.error ?? "Could not start the survey. Try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/s/${surveyId}/${data.participantId}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={start} className="mt-8">
      {collectsEmail && (
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email <span className="font-normal text-slate-muted">(optional)</span>
          </label>
          <p className="mt-1 text-sm text-slate-muted">
            Only if you want a follow-up. Leave it blank to stay anonymous — your
            answers are stored separately from your email either way.
          </p>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="ds-field mt-3"
            autoComplete="email"
          />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary mt-6">
        {submitting ? "Starting…" : "Start"} <span className="ds-arrow">→</span>
      </button>
    </form>
  );
}
