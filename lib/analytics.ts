import { getDb } from "./db";
import type { Question, ResponseValue, Survey } from "./types";

/**
 * Generic, survey-agnostic analytics.
 *
 * Every survey gets sensible defaults — tallies for select questions, averages
 * and distributions for scales, recent samples for open text. A survey can then
 * *declare* extra cuts in its `analytics` config (batteries of related scale
 * questions, a single-select that defines a segment) and get relevant charts
 * without anything being hardcoded here.
 */

export interface Tally {
  label: string;
  count: number;
}

export interface QuestionAnalytics {
  questionId: string;
  prompt: string;
  type: Question["type"];
  answered: number;
  /** Select and rank questions: how often each option was chosen. */
  tallies?: Tally[];
  /** Scale questions: mean, and the 1–5 histogram. */
  average?: number;
  distribution?: Tally[];
  /** Open text: the most recent answers. */
  samples?: string[];
}

export interface BatteryAnalytics {
  label: string;
  average: number;
  parts: { label: string; average: number }[];
}

export interface SegmentAnalytics {
  name: string;
  buckets: Tally[];
}

export interface SurveyAnalytics {
  surveyId: string;
  title: string;
  totals: { participants: number; completed: number; completionRate: number };
  questions: QuestionAnalytics[];
  batteries: BatteryAnalytics[];
  segments: SegmentAnalytics[];
  utmSources: Tally[];
}

const TEXT_SAMPLE_LIMIT = 25;

function decode(raw: string): ResponseValue {
  try {
    return JSON.parse(raw) as ResponseValue;
  } catch {
    return raw;
  }
}

function toLabels(value: ResponseValue): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === "" || value === null || value === undefined) return [];
  return [String(value)];
}

function tally(counts: Map<string, number>): Tally[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export async function getSurveyAnalytics(
  survey: Survey,
  questions: Question[],
): Promise<SurveyAnalytics> {
  const db = await getDb();

  const totalsRs = await db.execute({
    sql: `SELECT
            COUNT(*) AS participants,
            SUM(CASE WHEN completion_status = 'completed' THEN 1 ELSE 0 END) AS completed
          FROM participants WHERE survey_id = ?`,
    args: [survey.id],
  });
  const totalsRow = (totalsRs.rows[0] ?? {}) as unknown as Record<string, unknown>;
  const participants = Number(totalsRow.participants ?? 0);
  const completed = Number(totalsRow.completed ?? 0);

  const utmRs = await db.execute({
    sql: `SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS count
          FROM participants WHERE survey_id = ?
          GROUP BY source ORDER BY count DESC`,
    args: [survey.id],
  });
  const utmSources = utmRs.rows.map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return { label: String(row.source ?? "direct"), count: Number(row.count ?? 0) };
  });

  const answersRs = await db.execute({
    sql: `SELECT question_id, response_value, participant_id
          FROM responses WHERE survey_id = ? ORDER BY id DESC`,
    args: [survey.id],
  });

  // question_id -> decoded values, newest first
  const byQuestion = new Map<string, ResponseValue[]>();
  // participant_id -> { question_id: value }, for segment cuts
  const byParticipant = new Map<string, Record<string, ResponseValue>>();

  for (const row of answersRs.rows) {
    const r = row as unknown as {
      question_id: string;
      response_value: string;
      participant_id: string;
    };
    const value = decode(r.response_value);

    const list = byQuestion.get(r.question_id) ?? [];
    list.push(value);
    byQuestion.set(r.question_id, list);

    const answers = byParticipant.get(r.participant_id) ?? {};
    answers[r.question_id] = value;
    byParticipant.set(r.participant_id, answers);
  }

  const questionAnalytics: QuestionAnalytics[] = questions.map((q) => {
    const values = byQuestion.get(q.id) ?? [];
    const base: QuestionAnalytics = {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      answered: values.length,
    };

    if (q.type === "scale") {
      const numbers = values
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
      const counts = new Map<string, number>();
      for (let i = 1; i <= 5; i += 1) counts.set(String(i), 0);
      for (const n of numbers) counts.set(String(n), (counts.get(String(n)) ?? 0) + 1);
      return {
        ...base,
        average: mean(numbers),
        distribution: [...counts.entries()].map(([label, count]) => ({ label, count })),
      };
    }

    if (q.type === "text") {
      return {
        ...base,
        samples: values
          .map((v) => String(v).trim())
          .filter(Boolean)
          .slice(0, TEXT_SAMPLE_LIMIT),
      };
    }

    const counts = new Map<string, number>();
    for (const value of values) {
      for (const label of toLabels(value)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return { ...base, tallies: tally(counts) };
  });

  const analyticsConfig = survey.settings.analytics ?? {};
  const byId = new Map(questionAnalytics.map((q) => [q.questionId, q]));

  const batteries: BatteryAnalytics[] = (analyticsConfig.batteries ?? []).map((b) => {
    const parts = b.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is QuestionAnalytics => Boolean(q) && typeof q?.average === "number")
      .map((q) => ({ label: q.prompt, average: q.average ?? 0 }));
    return { label: b.label, average: mean(parts.map((p) => p.average)), parts };
  });

  const segments: SegmentAnalytics[] = (analyticsConfig.segments ?? []).map((s) => {
    const counts = new Map<string, number>();
    for (const answers of byParticipant.values()) {
      for (const label of toLabels(answers[s.questionId])) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return { name: s.name, buckets: tally(counts) };
  });

  return {
    surveyId: survey.id,
    title: survey.title,
    totals: {
      participants,
      completed,
      completionRate: participants === 0 ? 0 : Math.round((completed / participants) * 100),
    },
    questions: questionAnalytics,
    batteries,
    segments,
    utmSources,
  };
}
