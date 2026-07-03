import type { Attribution } from "./types";

/** First-touch attribution cookie set client-side on the inbound landing. */
export const ATTRIBUTION_COOKIE = "survey_attribution";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export function emptyAttribution(): Attribution {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    referrer: null,
  };
}

/** Parse the attribution cookie value into a normalized Attribution. */
export function parseAttribution(raw: string | undefined | null): Attribution {
  const out = emptyAttribution();
  if (!raw) return out;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of [...UTM_KEYS, "referrer"] as const) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 256);
    }
  } catch {
    // Malformed cookie — treat as no attribution.
  }
  return out;
}
