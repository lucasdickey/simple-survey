import type { OptionsFrom, Question, ResponseValue, VisibilityRule } from "./types";

/**
 * The flexible core: a declarative conditional-logic engine. Each question may
 * carry a `visibleWhen` rule that is evaluated against the answers collected so
 * far. This replaces the bespoke per-survey branching the original surveys
 * hardcoded in TypeScript — see the two example surveys for how the same
 * behavior is expressed as data.
 */

const asArray = (v: ResponseValue | undefined): string[] =>
  Array.isArray(v) ? v.map(String) : v === undefined ? [] : [String(v)];

const intersects = (values: string[], set: string[]) => values.some((v) => set.includes(v));

/** Evaluate a single rule against the participant's answers. */
export function isVisible(
  rule: VisibilityRule | undefined,
  answers: Record<string, ResponseValue>,
): boolean {
  if (!rule) return true;

  if ("all" in rule) return rule.all.every((r) => isVisible(r, answers));
  if ("any" in rule) return rule.any.some((r) => isVisible(r, answers));
  if ("not" in rule) return !isVisible(rule.not, answers);

  const value = answers[rule.when];

  if ("includesAny" in rule) return intersects(asArray(value), rule.includesAny);

  if ("equals" in rule) return value !== undefined && String(value) === rule.equals;

  if ("notOnly" in rule) {
    const arr = asArray(value);
    return arr.length > 0 && arr.some((v) => !rule.notOnly.includes(v));
  }

  if ("lte" in rule) return typeof value === "number" && value <= rule.lte;
  if ("gte" in rule) return typeof value === "number" && value >= rule.gte;

  return true;
}

/** Filter a question list down to those visible given the current answers. */
export function applicableQuestions(
  questions: Question[],
  answers: Record<string, ResponseValue>,
): Question[] {
  return questions.filter((q) => isVisible(q.visibleWhen, answers));
}

/**
 * Resolve a question's options at render time. If it declares `optionsFrom`,
 * the option list is computed from an earlier answer; otherwise its static
 * `options` are returned. (Generalizes v2's per-participant `form_where` list.)
 */
export function resolveOptions(
  question: Question,
  answers: Record<string, ResponseValue>,
): string[] {
  if (!question.optionsFrom) return question.options ?? [];
  return computeOptions(question.optionsFrom, answers);
}

export function computeOptions(
  spec: OptionsFrom,
  answers: Record<string, ResponseValue>,
): string[] {
  const driver = asArray(answers[spec.when]);
  const matched = spec.map.filter((row) => intersects(driver, row.match)).map((row) => row.label);
  return [...matched, ...(spec.always ?? [])];
}
