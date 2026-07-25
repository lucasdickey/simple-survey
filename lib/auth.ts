import { clerkConfigured } from "./clerk-config";

/**
 * Clerk is optional until keys are configured. Without keys the app runs open:
 * participants stay anonymous (or type an email manually) and the dashboard is
 * unprotected. Key resolution lives in `lib/clerk-config.ts`, because Stripe
 * Projects delivers Clerk credentials as a JSON blob rather than as the two
 * env vars the SDK expects.
 */
export const clerkEnabled = clerkConfigured;

export interface SessionUser {
  clerkUserId: string;
  email: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!clerkEnabled) return null;
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  if (!user) return null;
  return {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
  };
}
