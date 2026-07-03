# simple-survey — Build Plan

A self-contained build spec for a **flexible, multi-survey platform** shipped as a
**Stripe Projects template**, built in the repo **`lucasdickey/simple-survey`**.
This file is the root build plan for that repo; execute the phases in order. It
assumes an empty repo and does not depend on any other project.

> Naming: the repo is `simple-survey`; the product is still a *flexible*,
> config-driven survey platform (the name is just the repo, not a scope cut).

> Origin: this generalizes two real surveys ("agentic-inc" v1 and v2). Their
> question sets are the two example surveys to seed (see §12). If you have the
> source monorepo, the originals are `lib/survey.ts`, `lib/survey-v2.ts`,
> `lib/analytics.ts`, `lib/anthropic.ts`; everything needed to rebuild them is
> summarized here.

---

## 1. Mission

Let anyone define a survey (questions, sections, conditional logic), collect
responses anonymously or with an optional email, optionally email a survey admin
on submission, and view analytics behind auth. Provisioned end-to-end with Stripe
Projects: **Vercel** (hosting), **Turso** (DB), **Clerk** (auth), **Twilio
SendGrid** (email), **OpenRouter** (LLM gateway, model swappable).

## 2. Locked decisions (and why)

1. **Surveys are data, seeded from typed config.** Tables `surveys` + `questions`
   in Turso, seeded from `surveys/*.ts`. v1 ships config-driven; the schema
   supports a future dashboard **builder UI** with no migration. (Alternatives
   considered: pure config file → no multi-survey admin; full builder now → too
   large for v1.)
2. **Email = Twilio SendGrid, notify the survey admin on submission.** "Twilio"
   for *email* is SendGrid (Twilio core is SMS/voice). Graceful no-op when unset.
   Participant-receipt is a second template, left as a flag for later.
3. **LLM through OpenRouter only.** One OpenAI-compatible client; model chosen by
   env so it swaps with no code change. Powers the optional **chat/interview**
   survey mode, transcript→structured-answer **extraction**, and **theme/summary**
   generation. Graceful no-op when unset.
4. **Every provider is optional and env-configured.** The app builds and runs
   before any keys exist (local SQLite fallback, auth open, no email, no LLM).
   This mirrors how the originals degrade and is what makes it a good template.

**Provider-catalog caveat:** Turso, Clerk, and Vercel are known Stripe Projects
catalog providers. **SendGrid and OpenRouter may not be in the catalog** — verify
with `stripe projects catalog <provider> --json`. If absent, they're configured by
plain env var and the manifest simply omits their `services:` entries. Never guess
a `provider/service` slug; copy it from the catalog. Never pass `--accept-tos`
(the user must accept TOS themselves).

## 3. Stack

- **Next.js (App Router) + React + TypeScript.** Pin current stable; read the
  framework's own docs before writing app code if the version is unfamiliar.
- **Tailwind v4** (PostCSS) for styling.
- **Turso** via `@libsql/client` (SQLite-compatible, libSQL).
- **Clerk** via `@clerk/nextjs`.
- **OpenRouter** via the `openai` SDK pointed at `https://openrouter.ai/api/v1`.
- **SendGrid** via `@sendgrid/mail`.
- **Zod** for request validation. **Recharts** for dashboard charts.

## 4. Repo layout

```
/ (repo root = the template)
  app/
    layout.tsx                              # ClerkProvider wrapper (optional)
    (public)/s/[survey]/start/page.tsx      # email-optional entry
    (public)/s/[survey]/start/start-form.tsx
    (public)/s/[survey]/[participantId]/page.tsx
    (public)/s/[survey]/[participantId]/survey-client.tsx   # form runtime
    (public)/s/[survey]/[participantId]/chat-client.tsx     # optional chat mode
    (public)/s/[survey]/done/page.tsx
    (admin)/dashboard/page.tsx              # survey list (Clerk-gated)
    (admin)/dashboard/[survey]/page.tsx     # per-survey analytics
    api/surveys/[survey]/participants/route.ts
    api/surveys/[survey]/responses/route.ts          # save + on-complete email
    api/surveys/[survey]/interview/route.ts          # optional chat turn
    api/surveys/[survey]/interview/complete/route.ts # extract→persist
    api/surveys/[survey]/analytics/route.ts
    api/export/route.ts
  lib/
    db.ts surveys.ts visibility.ts responses.ts analytics.ts
    llm.ts email.ts auth.ts attribution.ts redact.ts types.ts
  surveys/agentic-inc-v1.ts  surveys/agentic-inc-v2.ts   # seed data (examples)
  scripts/seed.mjs  scripts/provision.sh
  registry-manifest.yaml  prompts/starter-to-product.md
  middleware.ts  .env.example  README.md  package.json  tsconfig.json
  next.config.ts  postcss.config.mjs  eslint.config.mjs
```

## 5. Data model

Two **physically separate** Turso databases. The analytics DB holds **no PII**;
the contacts DB is the only place email/clerk-id live, keyed by `participant_id`,
and is **fail-closed**: if the analytics DB is remote but the contacts DB is not
configured, throw rather than co-locate PII.

**Analytics DB** (`lib/db.ts`, `getDb()`):
```sql
CREATE TABLE surveys (
  id TEXT PRIMARY KEY,            -- slug, e.g. 'agentic-inc-v2'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','closed')),
  mode TEXT NOT NULL DEFAULT 'form' CHECK (mode IN ('form','chat')),
  admin_email TEXT,              -- where submission notifications go (optional)
  notify_on_submit INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE questions (
  id TEXT NOT NULL,              -- question id, unique within a survey
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  section TEXT NOT NULL,
  sort INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rank','scale','text','multi_select','single_select')),
  prompt TEXT NOT NULL,
  help TEXT,
  options_json TEXT,            -- JSON string[] for select types
  other_option TEXT,           -- label that reveals a free-text box
  layout TEXT,                 -- 'chips' | 'cards' for multi_select
  visible_when_json TEXT,      -- declarative gating rule (see §7); NULL = always
  PRIMARY KEY (survey_id, id)
);
CREATE TABLE participants (
  participant_id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  created_at TEXT NOT NULL,
  completion_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (completion_status IN ('in_progress','completed')),
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, referrer TEXT
);
CREATE TABLE responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL REFERENCES participants(participant_id),
  survey_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  response_type TEXT NOT NULL,
  response_value TEXT NOT NULL,   -- JSON-encoded: string | number | string[]
  created_at TEXT NOT NULL,
  UNIQUE (participant_id, question_id)
);
CREATE TABLE conversations (    -- only used by chat-mode surveys
  participant_id TEXT PRIMARY KEY REFERENCES participants(participant_id),
  survey_id TEXT NOT NULL,
  transcript TEXT NOT NULL,
  completion_status TEXT NOT NULL DEFAULT 'in_progress',
  themes TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
-- indexes on responses(participant_id), responses(question_id), participants(survey_id)
```

**Contacts DB** (`lib/db.ts`, `getContactsDb()` — separate URL + token):
```sql
CREATE TABLE contacts (
  participant_id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  email TEXT,
  clerk_user_id TEXT
);
```

`db.ts` lazily creates clients, runs DDL once on first use, falls back to
`file:local.db` / `file:local-contacts.db` in dev, and **throws** if the analytics
DB is remote (`TURSO_DATABASE_URL` set) but `CONTACTS_DATABASE_URL` is unset.

## 6. Core types (`lib/types.ts`)

```ts
type ResponseType = 'rank'|'scale'|'text'|'multi_select'|'single_select';
type ResponseValue = string | number | string[];
interface AnswerInput { question_id: string; response_type: ResponseType; response_value: ResponseValue; }
interface Question { id; survey_id; section; sort; type: ResponseType; prompt; help?; options?: string[];
  otherOption?: string; layout?: 'chips'|'cards'; visibleWhen?: VisibilityRule; }
interface Survey { id; title; description?; status; mode: 'form'|'chat'; adminEmail?: string;
  notifyOnSubmit: boolean; settings: Record<string,unknown>; }
```

## 7. The flexible part — generalized conditional logic (`lib/visibility.ts`)

Both originals hardcode branching in TypeScript. Generalize to a **declarative
rule** stored per question (`visible_when_json`) and evaluated against answers:

```ts
type VisibilityRule =
  | { when: string; includesAny: string[] }    // multi_select answer intersects list
  | { when: string; equals: string }           // single_select equals
  | { when: string; notOnly: string[] }        // answered, and not exclusively these (e.g. not only "None")
  | { all: VisibilityRule[] } | { any: VisibilityRule[] } | { not: VisibilityRule };

function isVisible(rule: VisibilityRule | undefined, answers: Record<string, ResponseValue>): boolean;
function applicableQuestions(qs: Question[], answers): Question[]; // filter by isVisible
```

This reproduces the originals exactly:
- v1 `segment: 'ai_native'` → `{ when:'q1', includesAny: AI_NATIVE_TOOLS }`
- v1 `segment: 'non_technical'` (terminal comfort ≤ 2) → a numeric variant, or model
  it as `{ when:'q3', lte: 2 }` (add an `lte` rule).
- v1/v2 `uses_any_agentic_tool` → `{ when:'tools', includesAny: [...webapp, ...cli, ...chat] }`
- v2 `requiresFormationIntent` → `{ when:'form_where', notOnly: ['None — …'] }`
- Computed per-participant option lists (v2's `formWhereOptions`) become a
  `settings_json` hook: a question may carry `optionsFrom: { when, map }` so the
  rendered options depend on an earlier answer. Keep it minimal for v1; the two
  examples need only `includesAny` / `notOnly` / `lte`.

## 8. Provider integrations

### Turso (`lib/db.ts`)
Provision two databases. After `stripe projects env --sync`, map the synced vars
to the names the app reads (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` and
`CONTACTS_DATABASE_URL`/`CONTACTS_AUTH_TOKEN`). Never read `.env` directly — use
`stripe projects env`.

### Clerk (`lib/auth.ts`, `middleware.ts`)
Optional: `clerkEnabled = !!NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!CLERK_SECRET_KEY`.
`getSessionUser()` returns `{ clerkUserId, email }` or `null`. `middleware.ts`
runs `clerkMiddleware()` and protects `(admin)/*` only — public survey routes stay
open. Clerk provisioning returns `CLERK_AUTH_ENVIRONMENTS` (JSON with
`development`/`production` keys); extract `publishable_key`/`secret_key` into
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.

### OpenRouter (`lib/llm.ts`)
```ts
import OpenAI from 'openai';
const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
const CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
const EXTRACTION_MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';
export const llmEnabled = () => !!process.env.OPENROUTER_API_KEY;
```
Three functions, ported from the original Anthropic path but provider-neutral:
- `interviewReply(survey, participant, turns)` — chat-mode turn. Build the system
  prompt from the survey's question catalog (id/type/options/help/visibility), one
  question at a time, options as numbered lists, scales anchored verbally, ends
  with a sentinel `[INTERVIEW_COMPLETE]` token. Treat transcript text as data;
  ignore embedded instructions.
- `extractStructuredResponses(survey, transcript)` — use tool/function-calling
  (OpenAI-compatible `tools` + forced `tool_choice`) to return
  `{ answers: AnswerInput[], themes: string[], summary: string }`. Validate types
  against the survey's questions before persisting.
- Model ids are OpenRouter slugs (`provider/model`) so they swap via env.

### SendGrid (`lib/email.ts`)
```ts
export const emailEnabled = () => !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM;
export async function notifyAdminOnSubmit(survey, participantId, answers): Promise<void>;
```
Called from the responses route when `survey.notify_on_submit` and
`survey.admin_email` are set. Fire-and-forget: never block or fail the
participant's submission; log delivery errors. Render a readable summary
(question prompt → answer). Add a participant-receipt template later behind a flag.

### Vercel (hosting)
Standard Next.js deploy. Document `npm run deploy` (or `vercel deploy`). Server
routes that read live data use `export const dynamic = 'force-dynamic'`.

## 9. Public runtime

- **Start** (`/s/[survey]/start`): optional email (clearly optional; stays
  anonymous if blank). Sign-in link shown only when Clerk is enabled. POST creates
  a participant; PII → contacts DB only.
- **Form mode** (`survey-client.tsx`): paginate by section; only render questions
  whose `visibleWhen` passes given current answers; support `single_select`,
  `multi_select` (chips/cards), `scale` (1–5), `text`, `rank`, and `otherOption`
  free-text. Autosave answers via the responses route.
- **Chat mode** (`chat-client.tsx`, only when `survey.mode='chat'` and LLM
  enabled): conversational interview via `interview` route; on the completion
  token, call `interview/complete` to extract + persist structured answers,
  themes, and summary.
- **Done** (`/s/[survey]/done`).
- API routes are **Zod-validated**, capture **first-touch UTM attribution** from a
  cookie, and **redact** structured PII from open-text answers before persisting
  (`lib/redact.ts`).

## 10. Admin dashboard (`(admin)/dashboard`, Clerk-gated)

- Survey list with per-survey totals.
- Per-survey analytics (`lib/analytics.ts`, generalized to take a `survey_id`):
  completion rate, by-mode totals, single/multi-select tallies, scale averages,
  open-text samples, conversation themes, UTM-source breakdown. The original's
  bespoke trust-curve/segment cuts become **config-declared** analytics blocks in
  `settings_json` (e.g. declare which scale questions form a "battery", which
  single-select defines a segment) so each survey gets relevant charts without
  hardcoding. Provide sensible generic defaults when nothing is declared.
- Exports: `/api/export?survey=…&format=csv|json` (responses) and a separate
  `format=contacts` (emails, from the contacts DB) — kept distinct from response
  data.

## 11. Stripe Projects provisioning

`scripts/provision.sh` (run where the CLI exists; confirm every slug via
`stripe projects catalog <provider> --json` first):
```bash
stripe projects init --yes
stripe projects add turso/database --name analytics-db \
  --config '{"name":"flexible-survey","location":"aws-us-east-1"}' --yes
stripe projects add turso/database --name contacts-db \
  --config '{"name":"flexible-survey-contacts","location":"aws-us-east-1"}' --yes
stripe projects add clerk/auth     --name auth
stripe projects add vercel/project --name hosting
# SendGrid / OpenRouter: add via Stripe Projects IF present in `catalog`; else set
#   SENDGRID_API_KEY, SENDGRID_FROM, OPENROUTER_API_KEY by hand.
stripe projects env --sync
```

`registry-manifest.yaml` — a starting point to PR into
`stripe/projects-template-registry` (declare only services that exist in catalog):
```yaml
guided: { category: saas, framework: nextjs }
template: lucasdickey/simple-survey
variant: default
default: true
variant_description: Vercel • Turso • Clerk • SendGrid • OpenRouter
install_command: npm install
metadata:
  name: Simple Survey
  description: Configurable surveys with analytics, optional email, and an LLM chat mode
  owner: lucasdickey
  tags: [Survey, Analytics, Next.js]
repo: https://github.com/lucasdickey/simple-survey/tree/main
ref: <pinned-commit-sha>
services:
  - vercel/project
  - clerk/auth
  - turso/database   # provisioned twice (analytics + contacts) at setup
next_steps:
  - { label: Run locally, command: npm run dev }
  - { label: Seed example surveys, command: npm run seed }
  - { label: Deploy, command: npm run deploy }
tier_plans:
  vercel/project: { free_lowest_cost: Vercel/hobby, starter_paid: Vercel/pro, higher_scale: Vercel/pro }
  clerk/auth:     { free_lowest_cost: Clerk/hobby,  starter_paid: Clerk/pro,  higher_scale: Clerk/pro }
  turso/database: { free_lowest_cost: turso/starter, starter_paid: turso/scaler, higher_scale: turso/scaler }
```
(For sharing, host the template in its own public repo and point `repo:`/`ref:`
there — a clean standalone repo, not a monorepo subdirectory.)

## 12. The two example surveys to seed (`surveys/*.ts` → `scripts/seed.mjs`)

Both are real, reviewed question sets. Port verbatim; they exercise the engine.

**agentic-inc-v1** — `mode: 'chat'`-capable (also works as a form). 8 sections:
Current Tool Usage, Formation Workflow Preferences, Trust Boundaries, Documents &
Data Room, Interaction Preferences, MCP and CLI Adoption, A bit about you,
Follow-up. ~30 questions across `multi_select`/`single_select`/`scale`/`text`,
with `otherOption` free-text, `layout:'cards'` for long options, and four branches:
`ai_native` (q1 ∈ AI-native tools), `non_technical` (terminal comfort ≤ 2),
`uses_any_agentic_tool`. Has a trust-curve battery (`trust_business_info`,
`trust_safe_generation`) and JTBD scenario list. *Source: original `lib/survey.ts`
+ analytics in `lib/analytics.ts`.*

**agentic-inc-v2** — `mode: 'form'`, streamlined and conditional. 5 sections:
Tools You Use, Forming a Company With These Tools, After You've Formed, Help vs.
Do-It-For-Me, A Bit About You. Tool families (web-app builders / AI chat / CLIs);
`form_where` options computed from the participant's tool selection; a
formation-intent gate (`requiresFormationIntent` → `notOnly:['None…']`) hides the
depth follow-ups for anyone who wouldn't form a company. *Source: original
`lib/survey-v2.ts`.* This one is the best demonstration of `visible_when` +
computed options.

Seed both with `status:'active'` and a clear "example" label so an admin can keep,
edit, or delete them.

## 13. Environment variables (`.env.example`)

```
# Turso — analytics DB (no PII)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
# Turso — contacts DB (PII only; required once analytics DB is remote)
CONTACTS_DATABASE_URL=
CONTACTS_AUTH_TOKEN=
# Clerk (optional; gates the dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# OpenRouter (optional; chat mode + extraction + summaries)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
OPENROUTER_CHAT_MODEL=anthropic/claude-haiku-4.5
# SendGrid (optional; admin notification on submit)
SENDGRID_API_KEY=
SENDGRID_FROM=
```

## 14. Build phases (checklist)

- [ ] **0. Scaffold** Next.js app + Tailwind + config; `package.json` scripts
  (`dev`, `build`, `start`, `lint`, `seed`, `deploy`).
- [ ] **1. Data + engine** `db.ts` (two DBs, fail-closed), `types.ts`,
  `surveys.ts` (load survey+questions), `visibility.ts`, `redact.ts`,
  `attribution.ts`.
- [ ] **2. Seed** `surveys/agentic-inc-v1.ts`, `surveys/agentic-inc-v2.ts`,
  `scripts/seed.mjs`.
- [ ] **3. Public form runtime** start → survey → done; Zod APIs for
  participants/responses; autosave; PII split.
- [ ] **4. OpenRouter** `llm.ts`; optional chat mode + extraction + themes/summary.
- [ ] **5. SendGrid** `email.ts`; wire admin notification into responses route.
- [ ] **6. Clerk** `middleware.ts` + `(admin)/dashboard` + analytics + export.
- [ ] **7. Stripe Projects** `provision.sh`, `registry-manifest.yaml`,
  `.env.example`, `README.md`, `prompts/starter-to-product.md`.
- [ ] **8. Verify** `npm install && npm run build && npm run lint`; document
  `npm run seed` and the provisioning flow; pin the manifest `ref` to the release
  commit.

## 15. Open decisions for the new-repo owner

- Seed examples **enabled** vs. **disabled samples to clone** (default: enabled,
  labeled "example").
- Include **chat/interview mode** in v1 or ship **form-only** first (default:
  include, gated behind `survey.mode` defaulting to `form`).
- Whether to add a **survey builder UI** in v1 (default: no — schema is
  builder-ready; ship config-seeded first).
- Participant **email receipt** in addition to admin notification (default: admin
  only for v1).
```
