import { notFound, redirect } from "next/navigation";
import { getAnswers, participantExists } from "@/lib/responses";
import { getSurvey } from "@/lib/surveys";
import { SurveyClient } from "./survey-client";

export const dynamic = "force-dynamic";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ survey: string; participantId: string }>;
}) {
  const { survey: surveyId, participantId } = await params;

  const loaded = await getSurvey(surveyId);
  if (!loaded) notFound();

  if (!(await participantExists(surveyId, participantId))) {
    redirect(`/s/${surveyId}/start`);
  }

  // Resuming works because answers are autosaved per section.
  const answers = await getAnswers(participantId);

  return (
    <SurveyClient
      survey={loaded.survey}
      questions={loaded.questions}
      participantId={participantId}
      initialAnswers={answers}
    />
  );
}
