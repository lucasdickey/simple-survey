import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkEnabled } from "@/lib/auth";
import { getSurvey } from "@/lib/surveys";
import { StartForm } from "./start-form";

export const dynamic = "force-dynamic";

export default async function StartPage({
  params,
}: {
  params: Promise<{ survey: string }>;
}) {
  const { survey: surveyId } = await params;
  const loaded = await getSurvey(surveyId);
  if (!loaded) notFound();

  const { survey, questions } = loaded;

  return (
    <main className="ds-container max-w-2xl py-16">
      <p className="ds-eyebrow">Survey</p>
      <h1 className="ds-h2 mt-3">{survey.title}</h1>
      {survey.description && <p className="ds-lead mt-3">{survey.description}</p>}

      <p className="mt-6 text-sm text-slate-muted">
        {questions.length} questions · about {Math.max(2, Math.round(questions.length / 3))}{" "}
        minutes · you can stop and come back
      </p>

      {survey.status !== "active" ? (
        <div className="ds-card mt-8 p-6">
          <p className="font-medium text-ink">This survey is closed.</p>
          <p className="mt-1 text-sm text-slate">Thanks for your interest.</p>
        </div>
      ) : (
        <StartForm surveyId={survey.id} collectsEmail={survey.collectsEmail} />
      )}

      {clerkEnabled && (
        <p className="mt-8 text-sm text-slate-muted">
          Running the survey?{" "}
          <Link href="/dashboard" className="ds-link">
            Sign in to the dashboard
          </Link>
        </p>
      )}
    </main>
  );
}
