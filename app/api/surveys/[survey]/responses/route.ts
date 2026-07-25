import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnswers, markCompleted, participantExists, saveAnswers } from "@/lib/responses";
import { getSurvey } from "@/lib/surveys";
import { notifyAdminOnSubmit } from "@/lib/twilio-email";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  question_id: z.string().min(1),
  response_type: z.enum(["rank", "scale", "text", "multi_select", "single_select"]),
  response_value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const bodySchema = z.object({
  participantId: z.string().min(1),
  answers: z.array(answerSchema).max(200),
  complete: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ survey: string }> },
) {
  const { survey: surveyId } = await params;

  const loaded = await getSurvey(surveyId);
  if (!loaded) {
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const { participantId, answers, complete } = parsed.data;

  if (!(await participantExists(surveyId, participantId))) {
    return NextResponse.json({ error: "Unknown participant." }, { status: 404 });
  }

  // Drop answers for questions this survey does not define, so a stale or
  // hand-crafted client cannot write arbitrary rows.
  const known = new Set(loaded.questions.map((q) => q.id));
  const accepted = answers.filter((a) => known.has(a.question_id));

  await saveAnswers(surveyId, participantId, accepted);

  if (complete) {
    await markCompleted(participantId);
    // Best effort: a failed notification must never fail a submission.
    const all = await getAnswers(participantId);
    void notifyAdminOnSubmit(loaded.survey, loaded.questions, all).catch(() => false);
  }

  return NextResponse.json({ saved: accepted.length, completed: Boolean(complete) });
}
