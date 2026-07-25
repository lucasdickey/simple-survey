/**
 * Environment resolution.
 *
 * `stripe projects env --pull` names credentials after the *resource* you
 * created, not after the provider. `stripe projects add turso/database --name
 * analytics-db` writes `ANALYTICS_DB_DATABASE_URL` / `ANALYTICS_DB_AUTH_TOKEN`;
 * `--name primary-db` writes `PRIMARY_DB_*`. A template can't know which name
 * the user picked, so every provider config resolves across a chain of
 * plausible names instead of betting on one.
 *
 * This mirrors the pattern Stripe uses in its own templates (`lib/database-
 * config.ts` there resolves `DATABASE_URL` → `NEON_CONNECTION_STRING` → …).
 */

/** First non-empty, trimmed value — or "" when nothing is set. */
export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}
