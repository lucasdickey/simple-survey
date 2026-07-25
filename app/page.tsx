import Link from "next/link";
import { appConfig } from "@/lib/app-config";
import { clerkConfigured } from "@/lib/clerk-config";
import { contactsDatabaseAvailable } from "@/lib/db";
import { listSurveys } from "@/lib/surveys";
import { analyticsIsRemote, contactsIsRemote } from "@/lib/turso-config";
import { twilioEmailConfigured } from "@/lib/twilio-config";

export const dynamic = "force-dynamic";

/**
 * Starter landing page. It doubles as the setup summary for a freshly
 * provisioned project — an agent productizing this app should replace the whole
 * readiness panel with real product storytelling (see `AGENTS.md`).
 */

function Status({ label, on, hint }: { label: string; on: boolean; hint: string }) {
  return (
    <div className="ds-card flex items-start justify-between gap-4 p-5">
      <div>
        <p className="font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm text-slate-muted">{hint}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          on ? "bg-blurple/10 text-blurple" : "bg-hairline text-slate-muted"
        }`}
      >
        {on ? "Ready" : "Not set"}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const surveys = await listSurveys();

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="ds-gradient" aria-hidden />
        <div className="ds-container relative z-10 py-20 text-white">
          <p className="ds-eyebrow text-white/80">{appConfig.productType}</p>
          <h1 className="ds-display mt-3 max-w-3xl">{appConfig.name}</h1>
          <p className="ds-lead mt-4 max-w-2xl text-white/90">{appConfig.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {surveys[0] && (
              <Link href={`/s/${surveys[0].id}/start`} className="ds-btn ds-btn-primary">
                Take the example survey <span className="ds-arrow">→</span>
              </Link>
            )}
            <Link href="/dashboard" className="ds-btn ds-btn-ghost">
              View the dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="ds-band">
        <div className="ds-container py-16">
          <h2 className="ds-h2">Surveys</h2>
          <p className="ds-lead mt-2">
            Surveys are data. Each one is authored as typed config in{" "}
            <code className="font-mono text-sm">surveys/</code>, seeded into the
            database, and rendered generically.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {surveys.map((survey) => (
              <Link
                key={survey.id}
                href={`/s/${survey.id}/start`}
                className="ds-card ds-card-lift block p-6"
              >
                <div className="flex items-center gap-2">
                  <h3 className="ds-h3">{survey.title}</h3>
                  {survey.settings.example && <span className="ds-badge">Example</span>}
                </div>
                {survey.description && (
                  <p className="mt-2 text-sm text-slate">{survey.description}</p>
                )}
                <p className="mt-4 text-sm font-medium text-blurple">
                  Start <span className="ds-arrow">→</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ds-container py-16">
        <h2 className="ds-h2">Setup</h2>
        <p className="ds-lead mt-2">
          Every provider is optional. With none configured the app runs against a
          local SQLite file, the dashboard is open, and email is skipped.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Status
            label="Analytics database"
            on={analyticsIsRemote}
            hint="Turso — surveys, questions, and responses. No personal data."
          />
          <Status
            label="Contacts database"
            on={contactsIsRemote}
            hint="A second Turso database — the only place email addresses live."
          />
          <Status
            label="Auth"
            on={clerkConfigured}
            hint="Clerk — gates the dashboard. Survey routes stay public."
          />
          <Status
            label="Email"
            on={twilioEmailConfigured}
            hint="Twilio — optional admin notification when a response lands."
          />
        </div>

        {!contactsDatabaseAvailable && (
          <div className="ds-card mt-6 border-l-4 border-l-blurple p-5">
            <p className="font-medium text-ink">A contacts database is required</p>
            <p className="mt-1 text-sm text-slate">
              The analytics database is remote but no contacts database is
              configured. Surveys that collect email will refuse to write rather
              than store personal data alongside responses.
            </p>
            <div className="ds-code mt-4">
              <pre>
{`stripe projects add turso/database --name contacts-db \\
  --config '{"name":"simple-survey-contacts","location":"aws-us-east-1"}'
stripe projects env --pull`}
              </pre>
            </div>
          </div>
        )}

        <p className="mt-8 text-sm text-slate-muted">
          Check{" "}
          <Link href="/api/health" className="ds-link">
            /api/health
          </Link>{" "}
          for the same summary as JSON.
        </p>
      </section>
    </main>
  );
}
