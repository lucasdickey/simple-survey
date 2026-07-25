Turn this generated app into a real product built on Simple Survey.

Start by reading `AGENTS.md`, then follow this workflow.

## 1. Starter audit

- Inspect `lib/app-config.ts`, `app/page.tsx`, `surveys/product-feedback.ts`,
  `surveys/event-signup.ts`, `lib/types.ts`, `lib/visibility.ts`, and
  `app/api/health/route.ts`.
- Read `lib/db.ts` carefully. Two physically separate databases is a deliberate
  design decision, not an accident — see the non-negotiables in `AGENTS.md`.
- Work out which integrations are already wired and which are unconfigured.
- Do not mistake the two example surveys for a product brief. They exist to
  exercise the engine and are meant to be deleted.

## 2. Discovery-first conversation

- If the user has not given a clear brief, do not jump into implementation.
- Open with something grounded like: `Looks like we're starting from square
  one. Tell me about the survey product you want to build.`
- If the product has no confirmed name, ask for it first. Do not invent one
  unless the user explicitly asks you to.
- Ask **one question at a time**. Never send a batch of six.
- Cover these over the course of the conversation:
  - product name
  - who is being surveyed, and by whom
  - what decision the results are supposed to inform
  - whether responses are anonymous, identified, or optional
  - the desired look and feel
  - color direction, with a few concrete suggestions
  - design direction, with a few concrete suggestions
  - references, constraints, must-haves, must-avoids
- For palettes, offer options like: minimal monochrome with one signal color;
  warm neutral editorial tones; deep dark mode with electric accents; bright
  modern SaaS with a confident primary.
- For design direction, offer options like: polished B2B dashboard; premium
  editorial; playful consumer app; developer-tool interface; clinical research
  instrument.
- If the user is unsure, offer 2–4 concrete directions rather than silently
  picking one.

## 3. Synthesis before coding

Summarize the brief back: confirmed name, who is surveyed, the decision the
data informs, anonymity model, tone and visual direction, and the first slice
you intend to build. Call out assumptions explicitly.

Then hand control back before making large edits:

- `Here is what I'm thinking`
- `Are you ready for me to start implementing this?`
- `I'll start with the landing page, then the survey runtime, then the
  dashboard.`

Do not start implementing until the user confirms.

## 4. Phased implementation

Work in this order unless the user asks otherwise.

**Phase 1 — landing page.** Establish the style and feel. Treat `app/page.tsx`
as the visual anchor for everything else. Remove the entire setup/readiness
panel — it is scaffolding, not product UI.

**Phase 2 — survey runtime and dashboard.** Carry the visual system into
`app/s/[survey]/…` and `app/dashboard/…`. The participant-facing runtime is the
surface that matters most; it should feel calm and fast, never like a form
generator.

**Phase 3 — the actual surveys and analytics.** Replace the two examples with
real survey definitions in `surveys/`. Declare the analytics cuts each survey
needs (`batteries`, `segments`, `openText`) rather than hardcoding charts.

Throughout:

- Delete the example surveys once real ones exist. They are labeled
  `example: true` precisely so they are easy to find and remove.
- Author new surveys as `SurveyDefinition` config, register them in
  `surveys/index.ts`, and run `npm run seed`. Do not hardcode questions into
  components.
- Express conditional logic as `visibleWhen` rules, never as branching in JSX.
  If a rule cannot express what you need, add a new rule variant to
  `VisibilityRule` in `lib/types.ts` and handle it in `lib/visibility.ts` — one
  place, not scattered.
- Use typography, color, spacing, and composition as one coherent system. Avoid
  generic AI-starter aesthetics: default fonts, timid palettes, predictable
  layouts, cookie-cutter copy.
- The build environment may not allow fetching Google Fonts. `app/globals.css`
  sets `--font-inter` and `--font-geist-mono` to system stacks for that reason;
  confirm font loading works before switching to `next/font/google`.
- Use the [Frontend Design Skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
  as the reference for visual quality.

## 5. Verification

- `npm run build` and `npm run lint` both pass.
- `/api/health` still reports accurately for every provider.
- Walk a full response: start → answer → submit → see it in the dashboard.
- Confirm at least one conditional question still hides and reveals correctly.
- Confirm open text is still redacted and email still lands only in the
  contacts database.
- Summarize what changed and what the user should decide next.
