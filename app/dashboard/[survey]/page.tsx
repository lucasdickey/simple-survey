import Link from "next/link";
import { notFound } from "next/navigation";
import { getSurveyAnalytics, type Tally } from "@/lib/analytics";
import { getSurvey } from "@/lib/surveys";

export const dynamic = "force-dynamic";

/**
 * Per-survey analytics. Charts are plain CSS bars on purpose — no charting
 * dependency to fight with when an agent restyles this into a real product.
 */

function Bars({ rows, max }: { rows: Tally[]; max?: number }) {
  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-1/2 shrink-0 truncate text-sm text-slate" title={row.label}>
            {row.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-blurple"
              style={{ width: `${(row.count / ceiling) * 100}%` }}
            />
          </div>
          <span className="ds-nums w-8 shrink-0 text-right text-sm text-slate-muted">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function SurveyAnalyticsPage({
  params,
}: {
  params: Promise<{ survey: string }>;
}) {
  const { survey: surveyId } = await params;
  const loaded = await getSurvey(surveyId);
  if (!loaded) notFound();

  const analytics = await getSurveyAnalytics(loaded.survey, loaded.questions);

  return (
    <main className="ds-container py-16">
      <Link href="/dashboard" className="ds-link text-sm">
        ← All surveys
      </Link>
      <h1 className="ds-h2 mt-4">{analytics.title}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="ds-card p-6">
          <p className="ds-stat">{analytics.totals.participants}</p>
          <p className="text-sm text-slate-muted">participants</p>
        </div>
        <div className="ds-card p-6">
          <p className="ds-stat">{analytics.totals.completed}</p>
          <p className="text-sm text-slate-muted">completed</p>
        </div>
        <div className="ds-card p-6">
          <p className="ds-stat">{analytics.totals.completionRate}%</p>
          <p className="text-sm text-slate-muted">completion rate</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`/api/export?survey=${surveyId}&format=csv`} className="ds-btn ds-btn-sm ds-btn-ghost">
          Export responses (CSV)
        </a>
        <a href={`/api/export?survey=${surveyId}&format=json`} className="ds-btn ds-btn-sm ds-btn-ghost">
          Export responses (JSON)
        </a>
        {loaded.survey.collectsEmail && (
          <a
            href={`/api/export?survey=${surveyId}&format=contacts`}
            className="ds-btn ds-btn-sm ds-btn-ghost"
          >
            Export contacts
          </a>
        )}
      </div>

      {analytics.batteries.length > 0 && (
        <section className="mt-14">
          <h2 className="ds-h3">Scores</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {analytics.batteries.map((battery) => (
              <div key={battery.label} className="ds-card p-6">
                <p className="font-medium text-ink">{battery.label}</p>
                <p className="ds-stat mt-2">{battery.average || "—"}</p>
                <div className="mt-4 space-y-1">
                  {battery.parts.map((part) => (
                    <div key={part.label} className="flex justify-between gap-3 text-sm">
                      <span className="truncate text-slate">{part.label}</span>
                      <span className="ds-nums text-slate-muted">{part.average}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {analytics.segments.length > 0 && (
        <section className="mt-14">
          <h2 className="ds-h3">Segments</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {analytics.segments.map((segment) => (
              <div key={segment.name} className="ds-card p-6">
                <p className="font-medium text-ink">{segment.name}</p>
                <Bars rows={segment.buckets} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="ds-h3">Questions</h2>
        <div className="mt-4 space-y-4">
          {analytics.questions.map((question) => (
            <div key={question.questionId} className="ds-card p-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium text-ink">{question.prompt}</p>
                <span className="ds-nums shrink-0 text-sm text-slate-muted">
                  {question.answered}
                </span>
              </div>

              {question.tallies && question.tallies.length > 0 && (
                <Bars rows={question.tallies} />
              )}

              {question.distribution && (
                <>
                  <p className="ds-nums mt-3 text-sm text-slate">
                    average {question.average || "—"}
                  </p>
                  <Bars rows={question.distribution} />
                </>
              )}

              {question.samples && (
                <ul className="mt-3 space-y-2">
                  {question.samples.map((sample, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-hairline pl-3 text-sm text-slate"
                    >
                      {sample}
                    </li>
                  ))}
                  {question.samples.length === 0 && (
                    <li className="text-sm text-slate-muted">No answers yet.</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="ds-h3">Traffic sources</h2>
        <div className="ds-card mt-4 p-6">
          {analytics.utmSources.length > 0 ? (
            <Bars rows={analytics.utmSources} />
          ) : (
            <p className="text-sm text-slate-muted">No participants yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
