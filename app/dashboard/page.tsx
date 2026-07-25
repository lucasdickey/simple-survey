import Link from "next/link";
import { getDb } from "@/lib/db";
import { listSurveys } from "@/lib/surveys";
import { clerkEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function participantCounts(): Promise<Record<string, number>> {
  try {
    const db = await getDb();
    const rs = await db.execute(
      "SELECT survey_id, COUNT(*) AS count FROM participants GROUP BY survey_id",
    );
    const out: Record<string, number> = {};
    for (const row of rs.rows) {
      const r = row as unknown as { survey_id: string; count: number };
      out[r.survey_id] = Number(r.count);
    }
    return out;
  } catch {
    return {};
  }
}

export default async function DashboardPage() {
  const [surveys, counts] = await Promise.all([listSurveys(), participantCounts()]);

  return (
    <main className="ds-container py-16">
      <p className="ds-eyebrow">Admin</p>
      <h1 className="ds-h2 mt-3">Surveys</h1>

      {!clerkEnabled && (
        <div className="ds-card mt-6 border-l-4 border-l-blurple p-5">
          <p className="font-medium text-ink">This dashboard is unprotected</p>
          <p className="mt-1 text-sm text-slate">
            No Clerk keys are configured, so anyone with the URL can read
            responses. Run <code className="font-mono">stripe projects add clerk/auth</code>{" "}
            before sharing a deployed link.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {surveys.map((survey) => (
          <Link
            key={survey.id}
            href={`/dashboard/${survey.id}`}
            className="ds-card ds-card-lift block p-6"
          >
            <div className="flex items-center gap-2">
              <h2 className="ds-h3">{survey.title}</h2>
              {survey.settings.example && <span className="ds-badge">Example</span>}
            </div>
            <p className="ds-stat mt-4">{counts[survey.id] ?? 0}</p>
            <p className="text-sm text-slate-muted">participants</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
