import type { SurveyDefinition } from "@/lib/types";

/**
 * Example survey #2 — the interesting one. It exercises the two features that
 * make the engine more than a form renderer:
 *
 *   - `notOnly` gating: everything after the first question is hidden for
 *     someone who picks only "None of these".
 *   - `optionsFrom`: the reminder question's options are computed per
 *     participant from the sessions they actually picked.
 *
 * Delete it, edit it, or copy it. Nothing in the runtime is specific to it.
 */

const NONE = "None of these — I'm just browsing";

const SESSIONS = [
  "Morning workshop — hands-on lab",
  "Afternoon workshop — architecture deep dive",
  "Evening keynote",
  "Hallway track / open networking",
];

export const eventSignup: SurveyDefinition = {
  id: "event-signup",
  title: "Event signup",
  description: "Tell us which sessions you want and we'll hold you a spot.",
  mode: "form",
  collectsEmail: true,
  example: true,
  sections: ["Sessions", "Your visit", "Access"],
  sectionIntros: {
    Sessions: "Pick anything that looks good — you can change your mind later.",
  },
  analytics: {
    segments: [{ name: "Attendance", questionId: "attendance_mode" }],
    openText: ["accessibility_needs", "topics_wanted"],
  },
  questions: [
    {
      id: "sessions",
      section: "Sessions",
      type: "multi_select",
      prompt: "Which sessions are you interested in?",
      help: "Pick as many as you like.",
      layout: "cards",
      options: [...SESSIONS, NONE],
    },
    // Everything below is hidden until the participant picks a real session.
    {
      id: "reminder_for",
      section: "Sessions",
      type: "single_select",
      prompt: "Which one should we remind you about first?",
      help: "Only the sessions you picked are listed.",
      visibleWhen: { when: "sessions", notOnly: [NONE] },
      // Computed per participant from the answer to `sessions`.
      optionsFrom: {
        when: "sessions",
        map: [
          { match: [SESSIONS[0]], label: "Morning workshop" },
          { match: [SESSIONS[1]], label: "Afternoon workshop" },
          { match: [SESSIONS[2]], label: "Evening keynote" },
          { match: [SESSIONS[3]], label: "Hallway track" },
        ],
        always: ["No reminder, thanks"],
      },
    },
    {
      id: "topics_wanted",
      section: "Sessions",
      type: "text",
      prompt: "Anything you're hoping gets covered?",
      visibleWhen: { when: "sessions", notOnly: [NONE] },
    },
    {
      id: "attendance_mode",
      section: "Your visit",
      type: "single_select",
      prompt: "How are you planning to attend?",
      options: ["In person", "Remote", "Undecided"],
      visibleWhen: { when: "sessions", notOnly: [NONE] },
    },
    {
      id: "travel_support",
      section: "Your visit",
      type: "single_select",
      prompt: "Do you need help with travel or accommodation?",
      options: ["No", "Yes — travel", "Yes — accommodation", "Yes — both"],
      // Nested rule: only in-person attendees who picked a real session.
      visibleWhen: {
        all: [
          { when: "sessions", notOnly: [NONE] },
          { when: "attendance_mode", equals: "In person" },
        ],
      },
    },
    {
      id: "confidence",
      section: "Your visit",
      type: "scale",
      prompt: "How likely are you to actually make it?",
      help: "1 = unlikely, 5 = already booked.",
      visibleWhen: { when: "sessions", notOnly: [NONE] },
    },
    {
      id: "accessibility_needs",
      section: "Access",
      type: "text",
      prompt: "Anything we should know to make the day work for you?",
      help: "Dietary requirements, accessibility needs, anything at all.",
      visibleWhen: { when: "sessions", notOnly: [NONE] },
    },
  ],
};
