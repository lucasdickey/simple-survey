import type { SurveyDefinition } from "@/lib/types";

/**
 * Example survey #1 — exercises every question type, `otherOption`,
 * `layout: "cards"`, and an `includesAny` visibility rule.
 *
 * Delete it, edit it, or copy it as the starting point for a real survey.
 * Nothing in the runtime is specific to it.
 */

const PAID_PLANS = ["Team", "Business", "Enterprise"];

export const productFeedback: SurveyDefinition = {
  id: "product-feedback",
  title: "Product feedback",
  description:
    "A short read on how the product is landing — what gets used, what gets in the way.",
  mode: "form",
  collectsEmail: true,
  example: true,
  sections: ["Your usage", "What works", "What doesn't", "About you"],
  sectionIntros: {
    "Your usage": "First, a little about how often you reach for the product.",
    "What doesn't": "Be blunt here. Nothing is off limits.",
  },
  analytics: {
    batteries: [
      {
        label: "Satisfaction",
        questionIds: ["ease_of_use", "reliability", "value_for_money"],
      },
    ],
    segments: [{ name: "Plan", questionId: "plan" }],
    openText: ["biggest_frustration", "one_change"],
  },
  questions: [
    {
      id: "frequency",
      section: "Your usage",
      type: "single_select",
      prompt: "How often do you use the product?",
      options: ["Daily", "A few times a week", "A few times a month", "Rarely"],
    },
    {
      id: "plan",
      section: "Your usage",
      type: "single_select",
      prompt: "Which plan are you on?",
      options: ["Free", ...PAID_PLANS, "Not sure"],
    },
    {
      id: "billing_clarity",
      section: "Your usage",
      type: "scale",
      prompt: "How clear is your billing?",
      help: "1 = confusing, 5 = completely clear.",
      // Only ask people who actually pay.
      visibleWhen: { when: "plan", includesAny: PAID_PLANS },
    },
    {
      id: "features_used",
      section: "What works",
      type: "multi_select",
      prompt: "Which parts do you actually use?",
      help: "Pick as many as apply.",
      layout: "chips",
      options: [
        "Dashboard",
        "Reports",
        "Integrations",
        "Notifications",
        "Mobile app",
        "API",
      ],
      otherOption: "Something else",
    },
    {
      id: "ease_of_use",
      section: "What works",
      type: "scale",
      prompt: "How easy is the product to use?",
      help: "1 = constant friction, 5 = effortless.",
    },
    {
      id: "reliability",
      section: "What works",
      type: "scale",
      prompt: "How reliable has it been?",
      help: "1 = breaks often, 5 = rock solid.",
    },
    {
      id: "value_for_money",
      section: "What works",
      type: "scale",
      prompt: "How would you rate the value for money?",
      help: "1 = poor value, 5 = excellent value.",
    },
    {
      id: "biggest_frustration",
      section: "What doesn't",
      type: "text",
      prompt: "What frustrates you most about the product?",
      help: "One specific thing beats a general list.",
    },
    {
      id: "blockers",
      section: "What doesn't",
      type: "multi_select",
      prompt: "Which of these have gotten in your way?",
      layout: "cards",
      options: [
        "It was hard to get started the first time",
        "I could not find a feature I knew existed",
        "It was too slow at a moment that mattered",
        "It did not fit the way my team already works",
        "I hit a limit and could not tell why",
      ],
    },
    {
      id: "priorities",
      section: "What doesn't",
      type: "rank",
      prompt: "Rank these by how much you want them improved.",
      help: "Drag or use the arrows — most important first.",
      options: ["Speed", "Reliability", "Ease of use", "Price", "Integrations"],
    },
    {
      id: "one_change",
      section: "What doesn't",
      type: "text",
      prompt: "If you could change exactly one thing, what would it be?",
    },
    {
      id: "role",
      section: "About you",
      type: "single_select",
      prompt: "What best describes your role?",
      options: [
        "Engineering",
        "Design",
        "Product",
        "Operations",
        "Leadership",
        "Something else",
      ],
    },
    {
      id: "team_size",
      section: "About you",
      type: "single_select",
      prompt: "How big is your team?",
      options: ["Just me", "2–10", "11–50", "51–200", "200+"],
    },
  ],
};
