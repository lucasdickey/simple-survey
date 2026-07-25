import { NextResponse } from "next/server";
import { appConfig } from "@/lib/app-config";
import { clerkConfigured } from "@/lib/clerk-config";
import { contactsDatabaseAvailable } from "@/lib/db";
import { twilioEmailConfigured } from "@/lib/twilio-config";
import { analyticsIsRemote, contactsIsRemote } from "@/lib/turso-config";

export const dynamic = "force-dynamic";

/**
 * Runtime configuration summary. This is the endpoint to hit after
 * `stripe projects env --pull` to confirm provisioning actually landed —
 * every flag should flip to `true` without editing an env var by hand.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: appConfig.slug,
    analyticsDatabaseConfigured: analyticsIsRemote,
    contactsDatabaseConfigured: contactsIsRemote,
    /**
     * False only when the analytics DB is remote but no contacts DB exists —
     * in that state a survey that collects email will refuse to write.
     */
    contactsDatabaseAvailable,
    clerkConfigured,
    emailConfigured: twilioEmailConfigured,
  });
}
