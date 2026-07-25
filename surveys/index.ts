import type { SurveyDefinition } from "@/lib/types";
import { eventSignup } from "./event-signup";
import { productFeedback } from "./product-feedback";

/**
 * Every survey the app knows about at build time. `npm run seed` writes these
 * into the database; the runtime also reads them directly, so the app works
 * before any seed has run.
 *
 * To add a survey: create `surveys/<id>.ts`, export a `SurveyDefinition`, and
 * add it here.
 */
export const surveyDefinitions: SurveyDefinition[] = [productFeedback, eventSignup];

export function findDefinition(id: string): SurveyDefinition | undefined {
  return surveyDefinitions.find((s) => s.id === id);
}
