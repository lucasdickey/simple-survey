import { createClient, type Client } from "@libsql/client";
import {
  analyticsAuthToken,
  analyticsDatabaseUrl,
  analyticsIsRemote,
  contactsAuthToken,
  contactsDatabaseUrl,
  contactsIsRemote,
  LOCAL_ANALYTICS_URL,
  LOCAL_CONTACTS_URL,
} from "./turso-config";

/**
 * Two physically separate databases.
 *
 * The **analytics** DB holds surveys, questions, participants, and responses,
 * and deliberately carries no PII. The **contacts** DB is the only place email
 * and clerk-id live, keyed by participant_id.
 *
 * The split fails closed: if the analytics DB is remote (real Turso) but no
 * contacts DB is configured, writing a contact throws rather than quietly
 * co-locating PII with response data. Note the check fires on the first contact
 * *write*, not at module load — a survey that collects no email needs only one
 * database and runs fine on a fresh `stripe projects build`.
 *
 * Schema is self-migrating: `CREATE TABLE IF NOT EXISTS` runs behind a memoized
 * promise on first use, so there is no separate migrate step to forget.
 */

let analyticsClient: Client | null = null;
let contactsClient: Client | null = null;
let analyticsSchema: Promise<void> | null = null;
let contactsSchema: Promise<void> | null = null;

export class ContactsDatabaseUnconfiguredError extends Error {
  constructor() {
    super(
      "This survey collects email, but no contacts database is configured. " +
        "Personal data must not share a database with response data. Provision a " +
        "second Turso database and set CONTACTS_DATABASE_URL / CONTACTS_AUTH_TOKEN:\n" +
        "  stripe projects add turso/database --name contacts-db \\\n" +
        "    --config '{\"name\":\"simple-survey-contacts\",\"location\":\"aws-us-east-1\"}'\n" +
        "  stripe projects env --pull",
    );
    this.name = "ContactsDatabaseUnconfiguredError";
  }
}

function analyticsRaw(): Client {
  if (!analyticsClient) {
    analyticsClient = createClient(
      analyticsIsRemote
        ? { url: analyticsDatabaseUrl, authToken: analyticsAuthToken || undefined }
        : { url: LOCAL_ANALYTICS_URL },
    );
  }
  return analyticsClient;
}

function contactsRaw(): Client {
  // Fail closed: never let PII land in the analytics database.
  if (analyticsIsRemote && !contactsIsRemote) {
    throw new ContactsDatabaseUnconfiguredError();
  }
  if (!contactsClient) {
    contactsClient = createClient(
      contactsIsRemote
        ? { url: contactsDatabaseUrl, authToken: contactsAuthToken || undefined }
        : { url: LOCAL_CONTACTS_URL },
    );
  }
  return contactsClient;
}

const ANALYTICS_DDL = [
  `CREATE TABLE IF NOT EXISTS surveys (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT,
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','closed')),
     mode TEXT NOT NULL DEFAULT 'form' CHECK (mode IN ('form','chat')),
     admin_email TEXT,
     notify_on_submit INTEGER NOT NULL DEFAULT 0,
     collects_email INTEGER NOT NULL DEFAULT 0,
     sections_json TEXT NOT NULL DEFAULT '[]',
     settings_json TEXT NOT NULL DEFAULT '{}',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS questions (
     id TEXT NOT NULL,
     survey_id TEXT NOT NULL REFERENCES surveys(id),
     section TEXT NOT NULL,
     sort INTEGER NOT NULL,
     type TEXT NOT NULL CHECK (type IN ('rank','scale','text','multi_select','single_select')),
     prompt TEXT NOT NULL,
     help TEXT,
     options_json TEXT,
     other_option TEXT,
     layout TEXT,
     visible_when_json TEXT,
     options_from_json TEXT,
     PRIMARY KEY (survey_id, id)
   )`,
  `CREATE TABLE IF NOT EXISTS participants (
     participant_id TEXT PRIMARY KEY,
     survey_id TEXT NOT NULL REFERENCES surveys(id),
     created_at TEXT NOT NULL,
     completion_status TEXT NOT NULL DEFAULT 'in_progress'
       CHECK (completion_status IN ('in_progress','completed')),
     utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
     utm_term TEXT, utm_content TEXT, referrer TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS responses (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     participant_id TEXT NOT NULL REFERENCES participants(participant_id),
     survey_id TEXT NOT NULL,
     question_id TEXT NOT NULL,
     response_type TEXT NOT NULL,
     response_value TEXT NOT NULL,
     created_at TEXT NOT NULL,
     UNIQUE (participant_id, question_id)
   )`,
  `CREATE INDEX IF NOT EXISTS responses_participant_idx ON responses (participant_id)`,
  `CREATE INDEX IF NOT EXISTS responses_question_idx ON responses (survey_id, question_id)`,
  `CREATE INDEX IF NOT EXISTS participants_survey_idx ON participants (survey_id)`,
];

const CONTACTS_DDL = [
  `CREATE TABLE IF NOT EXISTS contacts (
     participant_id TEXT PRIMARY KEY,
     survey_id TEXT NOT NULL,
     created_at TEXT NOT NULL,
     email TEXT,
     clerk_user_id TEXT
   )`,
];

/** Analytics database, schema ensured. Holds no PII. */
export async function getDb(): Promise<Client> {
  const client = analyticsRaw();
  if (!analyticsSchema) {
    analyticsSchema = (async () => {
      for (const sql of ANALYTICS_DDL) await client.execute(sql);
    })().catch((error) => {
      analyticsSchema = null;
      throw error;
    });
  }
  await analyticsSchema;
  return client;
}

/**
 * Contacts database, schema ensured. Throws
 * `ContactsDatabaseUnconfiguredError` when the analytics DB is remote and this
 * one is not — call it only when a survey actually collects email.
 */
export async function getContactsDb(): Promise<Client> {
  const client = contactsRaw();
  if (!contactsSchema) {
    contactsSchema = (async () => {
      for (const sql of CONTACTS_DDL) await client.execute(sql);
    })().catch((error) => {
      contactsSchema = null;
      throw error;
    });
  }
  await contactsSchema;
  return client;
}

/** True when a contacts write would succeed. Used by `/api/health`. */
export const contactsDatabaseAvailable = !analyticsIsRemote || contactsIsRemote;
