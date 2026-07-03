/**
 * Clerk is optional until keys are configured (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * and CLERK_SECRET_KEY). Without keys the app runs open: participants stay
 * anonymous (or type an email manually) and the dashboard is unprotected.
 */
export const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

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
