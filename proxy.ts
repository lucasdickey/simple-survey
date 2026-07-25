import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { clerkConfigured } from "@/lib/clerk-config";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` — this is that file.
 *
 * Only the admin dashboard is gated. Public survey routes stay open so
 * participants never hit a sign-in wall. With no Clerk keys configured the
 * whole app runs open, including the dashboard.
 */

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

const proxy = clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) await auth.protect();
    })
  : function unconfiguredClerkProxy() {
      return NextResponse.next();
    };

export default proxy;

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
