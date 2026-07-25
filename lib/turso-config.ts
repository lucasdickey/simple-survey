import { firstNonEmpty } from "./env";

/**
 * Turso connection settings for the two databases this app uses.
 *
 * - **analytics** holds surveys, questions, participants, and responses. No PII.
 * - **contacts** holds email / clerk-id keyed by participant_id. PII only.
 *
 * Both resolve across the env var names `stripe projects env --pull` is likely
 * to have written (see `lib/env.ts`), then fall back to a local SQLite file so
 * the app runs before anything is provisioned.
 */

export const analyticsDatabaseUrl = firstNonEmpty(
  process.env.TURSO_DATABASE_URL,
  process.env.ANALYTICS_DB_DATABASE_URL,
  process.env.PRIMARY_DB_DATABASE_URL,
  process.env.SURVEY_DB_DATABASE_URL,
);

export const analyticsAuthToken = firstNonEmpty(
  process.env.TURSO_AUTH_TOKEN,
  process.env.ANALYTICS_DB_AUTH_TOKEN,
  process.env.PRIMARY_DB_AUTH_TOKEN,
  process.env.SURVEY_DB_AUTH_TOKEN,
);

export const contactsDatabaseUrl = firstNonEmpty(
  process.env.CONTACTS_DATABASE_URL,
  process.env.CONTACTS_DB_DATABASE_URL,
);

export const contactsAuthToken = firstNonEmpty(
  process.env.CONTACTS_AUTH_TOKEN,
  process.env.CONTACTS_DB_AUTH_TOKEN,
);

/** Local dev fallbacks. `@libsql/client` speaks `file:` URLs natively. */
export const LOCAL_ANALYTICS_URL = "file:local.db";
export const LOCAL_CONTACTS_URL = "file:local-contacts.db";

/** True once the analytics DB points at Turso rather than a local file. */
export const analyticsIsRemote = Boolean(analyticsDatabaseUrl);
/** True once the contacts DB points at Turso rather than a local file. */
export const contactsIsRemote = Boolean(contactsDatabaseUrl);

export const tursoConfigured = analyticsIsRemote;
