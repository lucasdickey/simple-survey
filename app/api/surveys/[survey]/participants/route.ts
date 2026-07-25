import { NextResponse } from "next/server";
import { z } from "zod";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/lib/attribution";
import { getSessionUser } from "@/lib/auth";
import { ContactsDatabaseUnconfiguredError } from "@/lib/db";
import { createParticipant } from "@/lib/responses";
import { getSurvey } from "@/lib/surveys";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.union([z.email(), z.literal("")]).optional(),
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
  if (loaded.survey.status !== "active") {
    return NextResponse.json({ error: "This survey is not accepting responses." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = loaded.survey.collectsEmail ? parsed.data.email?.trim() || null : null;
  const session = await getSessionUser();

  const cookieHeader = request.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ATTRIBUTION_COOKIE}=`))
    ?.slice(ATTRIBUTION_COOKIE.length + 1);
  const attribution = parseAttribution(raw ? decodeURIComponent(raw) : null);

  try {
    const participantId = await createParticipant(
      loaded.survey,
      attribution,
      email,
      session?.clerkUserId ?? null,
    );
    return NextResponse.json({ participantId });
  } catch (error) {
    if (error instanceof ContactsDatabaseUnconfiguredError) {
      console.error(error.message);
      return NextResponse.json(
        {
          error:
            "This survey collects email, but no contacts database is configured. " +
            "See the server logs for the provisioning command.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
