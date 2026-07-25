"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerInput, Question, ResponseValue, Survey } from "@/lib/types";
import { applicableQuestions, resolveOptions } from "@/lib/visibility";

/**
 * The form runtime. It renders whatever questions the survey declares — nothing
 * here knows about any particular survey.
 *
 * Conditional logic is evaluated live against the answers collected so far, so
 * a question can appear or disappear as the participant types. Sections with no
 * visible questions are skipped entirely.
 */

/** An `otherOption` answer is stored as `"<label>: <free text>"`. */
function isOtherValue(value: string, otherOption: string) {
  return value === otherOption || value.startsWith(`${otherOption}:`);
}

function otherTextOf(value: string, otherOption: string) {
  return value.startsWith(`${otherOption}:`)
    ? value.slice(otherOption.length + 1).trim()
    : "";
}

function makeOtherValue(otherOption: string, text: string) {
  return text.trim() ? `${otherOption}: ${text.trim()}` : otherOption;
}

export function SurveyClient({
  survey,
  questions,
  participantId,
  initialAnswers,
}: {
  survey: Survey;
  questions: Question[];
  participantId: string;
  initialAnswers: Record<string, ResponseValue>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, ResponseValue>>(initialAnswers);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => applicableQuestions(questions, answers),
    [questions, answers],
  );

  // Only sections that still have something to ask.
  const sections = useMemo(
    () => survey.sections.filter((s) => visible.some((q) => q.section === s)),
    [survey.sections, visible],
  );

  const currentSection = sections[Math.min(sectionIndex, sections.length - 1)];
  const sectionQuestions = visible.filter((q) => q.section === currentSection);
  const isLast = sectionIndex >= sections.length - 1;

  function setAnswer(questionId: string, value: ResponseValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function persist(complete: boolean) {
    // Only send answers to questions that are currently visible — a question
    // that has been hidden by a changed answer should not be submitted.
    const visibleIds = new Set(visible.map((q) => q.id));
    const payload: AnswerInput[] = visible
      .filter((q) => visibleIds.has(q.id) && answers[q.id] !== undefined)
      .map((q) => ({
        question_id: q.id,
        response_type: q.type,
        response_value: answers[q.id],
      }));

    const response = await fetch(`/api/surveys/${survey.id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, answers: payload, complete }),
    });
    if (!response.ok) throw new Error("save failed");
  }

  async function next() {
    setSaving(true);
    setError(null);
    try {
      await persist(isLast);
      if (isLast) {
        router.push(`/s/${survey.id}/done`);
        return;
      }
      setSectionIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not save your answers. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const intro = survey.settings.sectionIntros?.[currentSection];

  return (
    <main className="ds-container max-w-2xl py-16">
      <div className="flex items-baseline justify-between">
        <p className="ds-eyebrow">{survey.title}</p>
        <p className="ds-nums text-sm text-slate-muted">
          {sectionIndex + 1} / {sections.length}
        </p>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-blurple transition-all duration-300"
          style={{ width: `${((sectionIndex + 1) / Math.max(sections.length, 1)) * 100}%` }}
        />
      </div>

      <h1 className="ds-h2 mt-8">{currentSection}</h1>
      {intro && <p className="ds-lead mt-2">{intro}</p>}

      <div className="mt-10 space-y-10">
        {sectionQuestions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            answers={answers}
            value={answers[question.id]}
            onChange={(value) => setAnswer(question.id, value)}
          />
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <div className="mt-12 flex items-center gap-3">
        {sectionIndex > 0 && (
          <button
            type="button"
            onClick={() => setSectionIndex((i) => i - 1)}
            className="ds-btn ds-btn-ghost"
            disabled={saving}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={saving}
          className="ds-btn ds-btn-primary"
        >
          {saving ? "Saving…" : isLast ? "Submit" : "Continue"}{" "}
          <span className="ds-arrow">→</span>
        </button>
      </div>
    </main>
  );
}

function QuestionField({
  question,
  answers,
  value,
  onChange,
}: {
  question: Question;
  answers: Record<string, ResponseValue>;
  value: ResponseValue | undefined;
  onChange: (value: ResponseValue) => void;
}) {
  const options = resolveOptions(question, answers);
  const cardLayout = question.layout === "cards";

  return (
    <div>
      <p className="font-medium text-ink">{question.prompt}</p>
      {question.help && <p className="mt-1 text-sm text-slate-muted">{question.help}</p>}

      <div className="mt-4">
        {question.type === "text" && (
          <textarea
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="ds-field"
            placeholder="Type your answer…"
          />
        )}

        {question.type === "scale" && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`ds-choice ds-nums w-12 justify-center ${value === n ? "is-on" : ""}`}
                aria-pressed={value === n}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {question.type === "single_select" && (
          <SingleSelect
            question={question}
            options={options}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            cardLayout={cardLayout}
          />
        )}

        {question.type === "multi_select" && (
          <MultiSelect
            question={question}
            options={options}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
            cardLayout={cardLayout}
          />
        )}

        {question.type === "rank" && (
          <Rank
            options={options}
            value={Array.isArray(value) ? value : options}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}

function SingleSelect({
  question,
  options,
  value,
  onChange,
  cardLayout,
}: {
  question: Question;
  options: string[];
  value: string;
  onChange: (value: ResponseValue) => void;
  cardLayout: boolean;
}) {
  const other = question.otherOption;
  const otherSelected = Boolean(other) && Boolean(value) && isOtherValue(value, other!);

  return (
    <div className={cardLayout ? "space-y-2" : "flex flex-wrap gap-2"}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`ds-choice ${cardLayout ? "w-full text-left" : ""} ${value === option ? "is-on" : ""}`}
          aria-pressed={value === option}
        >
          {option}
        </button>
      ))}

      {other && (
        <>
          <button
            type="button"
            onClick={() => onChange(makeOtherValue(other, ""))}
            className={`ds-choice ${cardLayout ? "w-full text-left" : ""} ${otherSelected ? "is-on" : ""}`}
            aria-pressed={otherSelected}
          >
            {other}
          </button>
          {otherSelected && (
            <input
              type="text"
              value={otherTextOf(value, other)}
              onChange={(e) => onChange(makeOtherValue(other, e.target.value))}
              placeholder="Tell us more…"
              className="ds-field mt-2"
            />
          )}
        </>
      )}
    </div>
  );
}

function MultiSelect({
  question,
  options,
  value,
  onChange,
  cardLayout,
}: {
  question: Question;
  options: string[];
  value: string[];
  onChange: (value: ResponseValue) => void;
  cardLayout: boolean;
}) {
  const other = question.otherOption;
  const otherEntry = other ? value.find((v) => isOtherValue(v, other)) : undefined;

  function toggle(option: string) {
    onChange(
      value.includes(option) ? value.filter((v) => v !== option) : [...value, option],
    );
  }

  function toggleOther() {
    if (!other) return;
    onChange(
      otherEntry
        ? value.filter((v) => !isOtherValue(v, other))
        : [...value, makeOtherValue(other, "")],
    );
  }

  function setOtherText(text: string) {
    if (!other) return;
    onChange([
      ...value.filter((v) => !isOtherValue(v, other)),
      makeOtherValue(other, text),
    ]);
  }

  return (
    <div className={cardLayout ? "space-y-2" : "flex flex-wrap gap-2"}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          className={`ds-choice ${cardLayout ? "w-full text-left" : ""} ${value.includes(option) ? "is-on" : ""}`}
          aria-pressed={value.includes(option)}
        >
          {option}
        </button>
      ))}

      {other && (
        <>
          <button
            type="button"
            onClick={toggleOther}
            className={`ds-choice ${cardLayout ? "w-full text-left" : ""} ${otherEntry ? "is-on" : ""}`}
            aria-pressed={Boolean(otherEntry)}
          >
            {other}
          </button>
          {otherEntry && (
            <input
              type="text"
              value={otherTextOf(otherEntry, other)}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Tell us more…"
              className="ds-field mt-2"
            />
          )}
        </>
      )}
    </div>
  );
}

function Rank({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (value: ResponseValue) => void;
}) {
  // Keep the working order in sync with the option list in case a computed
  // option list changed underneath us.
  const ordered = [
    ...value.filter((v) => options.includes(v)),
    ...options.filter((o) => !value.includes(o)),
  ];

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <ol className="space-y-2">
      {ordered.map((option, index) => (
        <li key={option} className="ds-choice flex w-full items-center gap-3">
          <span className="ds-nums w-5 text-slate-muted">{index + 1}</span>
          <span className="flex-1 text-left">{option}</span>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${option} up`}
              className="ds-btn ds-btn-sm ds-btn-ghost"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === ordered.length - 1}
              aria-label={`Move ${option} down`}
              className="ds-btn ds-btn-sm ds-btn-ghost"
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
