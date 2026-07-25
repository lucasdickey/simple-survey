/**
 * Seed the surveys defined in `surveys/*.ts` into the analytics database.
 *
 * Idempotent: re-running updates existing surveys and questions in place, and
 * removes questions that were deleted from the config. Responses are never
 * touched.
 *
 * Run with `npm run seed` (which loads tsx so the TypeScript survey configs
 * import directly).
 */
import { getDb } from "../lib/db.ts";
import { normalizeDefinition } from "../lib/surveys.ts";
import { surveyDefinitions } from "../surveys/index.ts";

const db = await getDb();
const now = new Date().toISOString();

for (const definition of surveyDefinitions) {
  const { survey, questions } = normalizeDefinition(definition);

  await db.execute({
    sql: `INSERT INTO surveys (
            id, title, description, status, mode, admin_email, notify_on_submit,
            collects_email, sections_json, settings_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            mode = excluded.mode,
            admin_email = excluded.admin_email,
            notify_on_submit = excluded.notify_on_submit,
            collects_email = excluded.collects_email,
            sections_json = excluded.sections_json,
            settings_json = excluded.settings_json`,
    args: [
      survey.id,
      survey.title,
      survey.description ?? null,
      survey.status,
      survey.mode,
      survey.adminEmail ?? null,
      survey.notifyOnSubmit ? 1 : 0,
      survey.collectsEmail ? 1 : 0,
      JSON.stringify(survey.sections),
      JSON.stringify(survey.settings),
      now,
    ],
  });

  for (const question of questions) {
    await db.execute({
      sql: `INSERT INTO questions (
              id, survey_id, section, sort, type, prompt, help,
              options_json, other_option, layout, visible_when_json, options_from_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (survey_id, id) DO UPDATE SET
              section = excluded.section,
              sort = excluded.sort,
              type = excluded.type,
              prompt = excluded.prompt,
              help = excluded.help,
              options_json = excluded.options_json,
              other_option = excluded.other_option,
              layout = excluded.layout,
              visible_when_json = excluded.visible_when_json,
              options_from_json = excluded.options_from_json`,
      args: [
        question.id,
        question.survey_id,
        question.section,
        question.sort,
        question.type,
        question.prompt,
        question.help ?? null,
        question.options ? JSON.stringify(question.options) : null,
        question.otherOption ?? null,
        question.layout ?? null,
        question.visibleWhen ? JSON.stringify(question.visibleWhen) : null,
        question.optionsFrom ? JSON.stringify(question.optionsFrom) : null,
      ],
    });
  }

  // Drop questions removed from the config so the DB mirrors the source.
  const ids = questions.map((q) => q.id);
  const placeholders = ids.map(() => "?").join(", ");
  await db.execute({
    sql: `DELETE FROM questions WHERE survey_id = ?${
      ids.length > 0 ? ` AND id NOT IN (${placeholders})` : ""
    }`,
    args: [survey.id, ...ids],
  });

  console.log(`Seeded ${survey.id} — ${questions.length} questions.`);
}

console.log(`\nDone. ${surveyDefinitions.length} surveys seeded.`);
