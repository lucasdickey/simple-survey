import { firstNonEmpty } from "./env";

/**
 * Clerk is optional. Without keys the app runs open: participants stay
 * anonymous and the dashboard is unprotected.
 *
 * `stripe projects add clerk/auth` does not write the two keys directly — it
 * writes a JSON blob holding both a development and a production environment.
 * The var is named after the resource, so resolve across the likely names and
 * unpack whichever environment is present.
 */

type ClerkEnvironment = {
  publishable_key?: string;
  secret_key?: string;
};

type ClerkEnvironmentPayload = {
  development?: ClerkEnvironment;
  production?: ClerkEnvironment;
};

function parseClerkEnvironments(): ClerkEnvironmentPayload | null {
  const raw = firstNonEmpty(
    process.env.CLERK_ENVIRONMENTS,
    process.env.CLERK_AUTH_ENVIRONMENTS,
    process.env.AUTH_ENVIRONMENTS,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClerkEnvironmentPayload;
  } catch {
    return null;
  }
}

const parsed = parseClerkEnvironments();
const derived = parsed?.development ?? parsed?.production ?? null;

export const clerkPublishableKey = firstNonEmpty(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  derived?.publishable_key,
);

export const clerkSecretKey = firstNonEmpty(
  process.env.CLERK_SECRET_KEY,
  derived?.secret_key,
);

// `@clerk/nextjs` reads these off `process.env` directly, so backfill whatever
// we unpacked from the JSON blob before the SDK initializes.
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && clerkPublishableKey) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
}
if (!process.env.CLERK_SECRET_KEY && clerkSecretKey) {
  process.env.CLERK_SECRET_KEY = clerkSecretKey;
}

export const clerkConfigured = Boolean(clerkPublishableKey && clerkSecretKey);
