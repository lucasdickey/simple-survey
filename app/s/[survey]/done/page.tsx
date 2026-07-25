import Link from "next/link";
import { notFound } from "next/navigation";
import { getSurvey } from "@/lib/surveys";

export const dynamic = "force-dynamic";

export default async function DonePage({
  params,
}: {
  params: Promise<{ survey: string }>;
}) {
  const { survey: surveyId } = await params;
  const loaded = await getSurvey(surveyId);
  if (!loaded) notFound();

  return (
    <main className="ds-container max-w-2xl py-24 text-center">
      <p className="ds-eyebrow">{loaded.survey.title}</p>
      <h1 className="ds-h2 mt-3">Thanks — that&rsquo;s everything.</h1>
      <p className="ds-lead mt-3">
        Your responses are recorded. You can close this tab.
      </p>
      <Link href="/" className="ds-btn ds-btn-ghost mt-8">
        Back to start
      </Link>
    </main>
  );
}
