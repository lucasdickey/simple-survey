/**
 * Core types for the flexible survey platform. A survey is data: its questions,
 * sections, and conditional logic are declared in `surveys/*.ts`, seeded into
 * Turso, and rendered generically. Nothing here is specific to any one survey.
 */

export type ResponseType = "rank" | "scale" | "text" | "multi_select" | "single_select";
export type ResponseValue = string | number | string[];

export type SurveyStatus = "active" | "draft" | "closed";
/** "form" = paginated form runtime; "chat" = conversational interview (needs an LLM). */
export type SurveyMode = "form" | "chat";

export interface AnswerInput {
  question_id: string;
  response_type: ResponseType;
  response_value: ResponseValue;
}

/**
 * Declarative visibility rule, evaluated against the participant's answers so
 * far (see `lib/visibility.ts`). Replaces the hardcoded TypeScript branching the
 * original surveys used. `undefined` means the question is always shown.
 */
export type VisibilityRule =
  // A multi_select answer (array) intersects `includesAny`.
  | { when: string; includesAny: string[] }
  // A single_select / text answer equals `equals`.
  | { when: string; equals: string }
  // A multi_select answer is non-empty and holds at least one value NOT in
  // `notOnly` (e.g. picked something other than just "None").
  | { when: string; notOnly: string[] }
  // A numeric (scale) answer compares against the bound.
  | { when: string; lte: number }
  | { when: string; gte: number }
  // Boolean combinators.
  | { all: VisibilityRule[] }
  | { any: VisibilityRule[] }
  | { not: VisibilityRule };

/**
 * Computed per-participant option list: a question's options are derived from an
 * earlier answer. Each `map` row contributes its `label` when the driving
 * answer intersects `match`; `always` labels are appended unconditionally.
 * (This generalizes v2's `formWhereOptions`.)
 */
export interface OptionsFrom {
  when: string;
  map: { match: string[]; label: string }[];
  always?: string[];
}

export interface Question {
  id: string;
  survey_id: string;
  section: string;
  sort: number;
  type: ResponseType;
  prompt: string;
  /** Plain-language context / examples rendered under the prompt. */
  help?: string;
  options?: string[];
  /**
   * Label of the option that reveals a free-text box when selected. The typed
   * value is stored as `"<label>: <text>"`.
   */
  otherOption?: string;
  /** How a multi_select renders: "chips" (short labels) or "cards" (sentences). */
  layout?: "chips" | "cards";
  /** Declarative gating; NULL/undefined = always visible. */
  visibleWhen?: VisibilityRule;
  /** Options computed from an earlier answer (overrides `options` at render). */
  optionsFrom?: OptionsFrom;
}

/** Per-survey analytics declarations (stored in `settings_json`). */
export interface AnalyticsConfig {
  /** Groups of scale questions averaged together (e.g. a "trust battery"). */
  batteries?: { label: string; questionIds: string[] }[];
  /** Single-select questions whose answers define a segment cut. */
  segments?: { name: string; questionId: string }[];
  /** Open-text question ids whose recent answers are sampled on the dashboard. */
  openText?: string[];
}

export interface SurveySettings {
  /** Short intro shown above the first question of a section. */
  sectionIntros?: Record<string, string>;
  /** Marks the two bundled demo surveys so an admin can keep/edit/delete them. */
  example?: boolean;
  analytics?: AnalyticsConfig;
  [key: string]: unknown;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  mode: SurveyMode;
  /** Where submission notifications go (optional). */
  adminEmail?: string;
  notifyOnSubmit: boolean;
  settings: SurveySettings;
  /** Ordered section names. */
  sections: string[];
}

/**
 * The authoring shape for a survey in `surveys/*.ts`. Seeded into the DB and
 * also used directly by the runtime so the app works before any seed runs.
 */
export interface QuestionDef {
  id: string;
  section: string;
  type: ResponseType;
  prompt: string;
  help?: string;
  options?: string[];
  otherOption?: string;
  layout?: "chips" | "cards";
  visibleWhen?: VisibilityRule;
  optionsFrom?: OptionsFrom;
}

export interface SurveyDefinition {
  id: string;
  title: string;
  description?: string;
  status?: SurveyStatus;
  mode?: SurveyMode;
  adminEmail?: string;
  notifyOnSubmit?: boolean;
  /** Ordered section names; question order follows array order within a section. */
  sections: string[];
  sectionIntros?: Record<string, string>;
  analytics?: AnalyticsConfig;
  example?: boolean;
  questions: QuestionDef[];
}

/** First-touch marketing attribution captured from inbound URL params. */
export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
}

/** Analytics-side participant record — deliberately carries no PII. */
export interface Participant {
  participant_id: string;
  survey_id: string;
  created_at: string;
  completion_status: "in_progress" | "completed";
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
}

/** Contacts-side record (PII), in a physically separate database. */
export interface Contact {
  participant_id: string;
  survey_id: string;
  created_at: string;
  email: string | null;
  clerk_user_id: string | null;
}

export interface Conversation {
  participant_id: string;
  survey_id: string;
  transcript: string;
  completion_status: "in_progress" | "completed";
  themes: string[];
  summary: string;
  updated_at: string;
}
