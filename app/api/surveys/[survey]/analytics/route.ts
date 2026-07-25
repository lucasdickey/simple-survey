import { NextResponse } from "next/server";
import { getSurveyAnalytics } from "@/lib/analytics";
import { clerkEnabled, getSessionUser } from "@/lib/auth";
import { getSurvey } from "@/lib/surveys";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ survey: string }> },
) {
  // The dashboard pages are gated by `proxy.ts`, but this route is reachable
  // directly, so it re-checks rather than trusting the proxy.
  if (clerkEnabled && !(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { survey: surveyId } = await params;
  const loaded = await getSurvey(surveyId);
  if (!loaded) {
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  }

  return NextResponse.json(await getSurveyAnalytics(loaded.survey, loaded.questions));
}
