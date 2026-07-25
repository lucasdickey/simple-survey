import { appConfig } from "./app-config";
import { firstNonEmpty } from "./env";

/**
 * Email is optional and provisioned via `stripe projects add twilio/email` —
 * which is Twilio SendGrid. Note that Projects hands back OAuth client
 * credentials rather than a classic `SG.` API key, so this authenticates with a
 * client-credentials token exchange (see `lib/twilio-email.ts`).
 */

export const twilioAccountSid = firstNonEmpty(process.env.TWILIO_ACCOUNT_SID);
export const twilioOAuthClientId = firstNonEmpty(process.env.TWILIO_OAUTH_CLIENT_ID);
export const twilioOAuthClientSecret = firstNonEmpty(
  process.env.TWILIO_OAUTH_CLIENT_SECRET,
);

/** Must be a Twilio-verified sender or delivery is rejected. */
export const twilioEmailFromAddress = firstNonEmpty(process.env.TWILIO_EMAIL_FROM_ADDRESS);
export const twilioEmailFromName = firstNonEmpty(
  process.env.TWILIO_EMAIL_FROM_NAME,
  appConfig.name,
);

export const twilioEmailConfigured = Boolean(
  twilioOAuthClientId && twilioOAuthClientSecret && twilioEmailFromAddress,
);
