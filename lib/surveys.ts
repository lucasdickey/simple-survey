import { getDb } from "./db";
import { findDefinition, surveyDefinitions } from "@/surveys";
import type {
  OptionsFrom,
  Question,
  Survey,
  SurveyDefinition,
  SurveyMode,
  SurveySettings,
  SurveyStatus,
  VisibilityRule,
} from "./types";

/**
 * Surveys are data. They are authored as typed config in `surveys/*.ts`, seeded
 * into the database by `npm run seed`, and read back generically here.
 *
 * Reads prefer the database (so a future builder UI can edit surveys without a
 * migration) and fall back to the static definition when a survey has not been
 * seeded yet — which is what makes the app work on a fresh clone with no
 * database and no seed step.
 */

type Cell = string | number | bigint | ArrayBuffer | Uint8Array | null | undefined;

const str = (v: Cell): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const nullableStr = (v: Cell): string | undefined => {
  const s = str(v);
  return s === "" ? undefined : s;
};
const num = (v: Cell): number =>
  typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : Number(str(v) || 0);

function parseJson<T>(raw: Cell, fallback: T): T {
  const s = str(raw);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Expand an authored definition into the runtime shapes. */
export function normalizeDefinition(def: SurveyDefinition): {
  survey: Survey;
  questions: Question[];
} {
  const settings: SurveySettings = {};
  if (def.sectionIntros) settings.sectionIntros = def.sectionIntros;
  if (def.analytics) settings.analytics = def.analytics;
  if (def.example) settings.example = true;

  const survey: Survey = {
    id: def.id,
    title: def.title,
    description: def.description,
    status: def.status ?? "active",
    mode: def.mode ?? "form",
    adminEmail: def.adminEmail,
    notifyOnSubmit: def.notifyOnSubmit ?? false,
    collectsEmail: def.collectsEmail ?? false,
    settings,
    sections: def.sections,
  };

  // Sort order is the authored array order, numbered within each section so a
  // later builder UI can reorder without renumbering everything.
  const counters = new Map<string, number>();
  const questions: Question[] = def.questions.map((q) => {
    const next = (counters.get(q.section) ?? 0) + 1;
    counters.set(q.section, next);
    return { ...q, survey_id: def.id, sort: next };
  });

  return { survey, questions };
}

function rowToSurvey(row: Record<string, Cell>): Survey {
  return {
    id: str(row.id),
    title: str(row.title),
    description: nullableStr(row.description),
    status: (str(row.status) || "active") as SurveyStatus,
    mode: (str(row.mode) || "form") as SurveyMode,
    adminEmail: nullableStr(row.admin_email),
    notifyOnSubmit: num(row.notify_on_submit) === 1,
    collectsEmail: num(row.collects_email) === 1,
    settings: parseJson<SurveySettings>(row.settings_json, {}),
    sections: parseJson<string[]>(row.sections_json, []),
  };
}

function rowToQuestion(row: Record<string, Cell>): Question {
  const options = parseJson<string[] | null>(row.options_json, null);
  const visibleWhen = parseJson<VisibilityRule | null>(row.visible_when_json, null);
  const optionsFrom = parseJson<OptionsFrom | null>(row.options_from_json, null);
  const layout = nullableStr(row.layout);

  return {
    id: str(row.id),
    survey_id: str(row.survey_id),
    section: str(row.section),
    sort: num(row.sort),
    type: str(row.type) as Question["type"],
    prompt: str(row.prompt),
    help: nullableStr(row.help),
    ...(options ? { options } : {}),
    otherOption: nullableStr(row.other_option),
    ...(layout === "chips" || layout === "cards" ? { layout } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
    ...(optionsFrom ? { optionsFrom } : {}),
  };
}

/** All surveys, database first, falling back to the authored definitions. */
export async function listSurveys(): Promise<Survey[]> {
  try {
    const db = await getDb();
    const rs = await db.execute(
      "SELECT * FROM surveys WHERE status != 'draft' ORDER BY created_at ASC",
    );
    if (rs.rows.length > 0) {
      return rs.rows.map((r) => rowToSurvey(r as unknown as Record<string, Cell>));
    }
  } catch {
    // Unreachable database — fall through to the authored definitions so the
    // app still renders.
  }
  return surveyDefinitions.map((d) => normalizeDefinition(d).survey);
}

/** One survey plus its questions, in section then sort order. */
export async function getSurvey(
  id: string,
): Promise<{ survey: Survey; questions: Question[] } | null> {
  try {
    const db = await getDb();
    const surveyRs = await db.execute({
      sql: "SELECT * FROM surveys WHERE id = ?",
      args: [id],
    });
    if (surveyRs.rows.length > 0) {
      const survey = rowToSurvey(surveyRs.rows[0] as unknown as Record<string, Cell>);
      const qRs = await db.execute({
        sql: "SELECT * FROM questions WHERE survey_id = ? ORDER BY sort ASC",
        args: [id],
      });
      const questions = qRs.rows.map((r) =>
        rowToQuestion(r as unknown as Record<string, Cell>),
      );
      // Keep the authored section order even though SQL sorts by `sort`.
      questions.sort(
        (a, b) =>
          survey.sections.indexOf(a.section) - survey.sections.indexOf(b.section) ||
          a.sort - b.sort,
      );
      if (questions.length > 0) return { survey, questions };
    }
  } catch {
    // Fall through.
  }

  const def = findDefinition(id);
  return def ? normalizeDefinition(def) : null;
}
