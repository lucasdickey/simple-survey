import { randomUUID } from "node:crypto";
import { getContactsDb, getDb } from "./db";
import { redactValue } from "./redact";
import type { AnswerInput, Attribution, ResponseValue, Survey } from "./types";

/**
 * Writing participants, answers, and contacts.
 *
 * The split is the point: everything here writes to the analytics database
 * except `saveContact`, which is the only function that touches PII and the
 * only one that talks to the contacts database.
 */

export async function createParticipant(
  survey: Survey,
  attribution: Attribution,
  email?: string | null,
  clerkUserId?: string | null,
): Promise<string> {
  const participantId = randomUUID();
  const now = new Date().toISOString();

  // Write the contact first: if the contacts database is missing we want to
  // fail before creating an orphaned participant row.
  if (email || clerkUserId) {
    await saveContact(survey.id, participantId, email ?? null, clerkUserId ?? null);
  }

  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO participants (
            participant_id, survey_id, created_at, completion_status,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer
          ) VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?)`,
    args: [
      participantId,
      survey.id,
      now,
      attribution.utm_source,
      attribution.utm_medium,
      attribution.utm_campaign,
      attribution.utm_term,
      attribution.utm_content,
      attribution.referrer,
    ],
  });

  return participantId;
}

/** The only writer of personal data, and the only caller of the contacts DB. */
export async function saveContact(
  surveyId: string,
  participantId: string,
  email: string | null,
  clerkUserId: string | null,
): Promise<void> {
  const contacts = await getContactsDb();
  await contacts.execute({
    sql: `INSERT INTO contacts (participant_id, survey_id, created_at, email, clerk_user_id)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (participant_id) DO UPDATE SET
            email = COALESCE(excluded.email, contacts.email),
            clerk_user_id = COALESCE(excluded.clerk_user_id, contacts.clerk_user_id)`,
    args: [participantId, surveyId, new Date().toISOString(), email, clerkUserId],
  });
}

/**
 * Upsert answers. Open text is redacted before it is persisted, so structured
 * PII never lands in the analytics database even if a participant types it into
 * a free-text box.
 */
export async function saveAnswers(
  surveyId: string,
  participantId: string,
  answers: AnswerInput[],
): Promise<void> {
  if (answers.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();

  await db.batch(
    answers.map((a) => ({
      sql: `INSERT INTO responses (
              participant_id, survey_id, question_id, response_type, response_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (participant_id, question_id) DO UPDATE SET
              response_value = excluded.response_value,
              response_type = excluded.response_type`,
      args: [
        participantId,
        surveyId,
        a.question_id,
        a.response_type,
        JSON.stringify(redactValue(a.response_value)),
        now,
      ],
    })),
    "write",
  );
}

export async function markCompleted(participantId: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE participants SET completion_status = 'completed' WHERE participant_id = ?",
    args: [participantId],
  });
}

export async function participantExists(
  surveyId: string,
  participantId: string,
): Promise<boolean> {
  const db = await getDb();
  const rs = await db.execute({
    sql: "SELECT 1 FROM participants WHERE participant_id = ? AND survey_id = ?",
    args: [participantId, surveyId],
  });
  return rs.rows.length > 0;
}

/** Answers so far, as the `{ questionId: value }` map the runtime evaluates. */
export async function getAnswers(
  participantId: string,
): Promise<Record<string, ResponseValue>> {
  const db = await getDb();
  const rs = await db.execute({
    sql: "SELECT question_id, response_value FROM responses WHERE participant_id = ?",
    args: [participantId],
  });

  const out: Record<string, ResponseValue> = {};
  for (const row of rs.rows) {
    const r = row as unknown as { question_id: string; response_value: string };
    try {
      out[r.question_id] = JSON.parse(r.response_value) as ResponseValue;
    } catch {
      out[r.question_id] = r.response_value;
    }
  }
  return out;
}
