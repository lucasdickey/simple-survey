# Simple Survey

Config-driven surveys with conditional logic, anonymous responses, and an
analytics dashboard. Next.js 16, Turso, Clerk, Vercel.

Ships as a [Stripe Projects](https://docs.stripe.com/projects) build template,
and works as a normal open-source Next.js app if you'd rather just clone it.

```bash
npm install && npm run seed && npm run dev
```

No API keys required. It runs against a local SQLite file until you provision
anything.

---

## What you get

- **Surveys are data.** Question sets are typed config in `surveys/*.ts`, seeded
  into the database and rendered generically. Nothing in the runtime knows about
  any particular survey.
- **Declarative conditional logic.** A question carries a `visibleWhen` rule
  evaluated against the answers so far — `includesAny`, `equals`, `notOnly`,
  `lte`/`gte`, plus `all`/`any`/`not` combinators. Questions appear and
  disappear live; sections that empty out are skipped.
- **Computed options.** A question's choices can be derived from an earlier
  answer via `optionsFrom`.
- **Privacy by construction.** Two physically separate databases: responses in
  one, email addresses in the other. Open text is redacted before storage, and
  the app fails closed rather than co-locating personal data.
- **Every provider optional.** Builds and runs with an empty `.env`.
- **Five question types.** `single_select`, `multi_select` (chips or cards),
  `scale`, `text`, `rank` — plus an "other" free-text escape hatch.
- **Analytics that follow the config.** Tallies, distributions and text samples
  by default; a survey can declare score batteries and segment cuts to get
  relevant charts with no hardcoding.
- **CSV / JSON export**, with contact export kept deliberately separate.

---

## Getting started

### If you arrived via `stripe projects build`

Your services are already provisioned and `.env` is already populated. You need
two commands:

```bash
npm run seed   # write the example surveys into your database
npm run dev
```

Then confirm the provisioning actually landed:

```bash
curl localhost:3000/api/health
```

Every flag should read `true`. If one doesn't, the matching service wasn't
provisioned — see [Provisioning](#provisioning) below.

### If you cloned this repo directly

```bash
git clone https://github.com/lucasdickey/simple-survey.git
cd simple-survey
npm install
npm run seed
npm run dev
```

Open http://localhost:3000. With no environment variables set the app uses
`local.db` and `local-contacts.db`, and the dashboard is unprotected — fine for
local work, not for anything public.

To go to production you need a database (and, before sharing a link, auth). Use
Stripe Projects (below), or set the variables in `.env.example` yourself against
your own Turso/Clerk accounts. Nothing in the app requires Stripe Projects.

---

## Provisioning

```bash
./scripts/provision.sh
```

Which runs:

```bash
stripe projects init
stripe projects add turso/database --name analytics-db   # responses, no PII
stripe projects add turso/database --name contacts-db    # email only
stripe projects add clerk/auth     --name auth
stripe projects add vercel/project --name hosting
stripe projects env --pull
```

Optional:

```bash
stripe projects add twilio/email --name email   # admin notification on submit
```

**On environment variable names.** `stripe projects env --pull` names
credentials after the *resource*, so `--name analytics-db` produces
`ANALYTICS_DB_DATABASE_URL`, not `TURSO_DATABASE_URL`. Clerk arrives as a
`CLERK_ENVIRONMENTS` JSON blob rather than as two keys. `lib/turso-config.ts`
and `lib/clerk-config.ts` resolve across the plausible spellings, so you should
never need to rename anything by hand. If you use a different `--name`, add it
to the chain there.

---

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page and setup summary |
| `/s/[survey]/start` | Entry point; optional email |
| `/s/[survey]/[participantId]` | The survey runtime |
| `/s/[survey]/done` | Completion page |
| `/dashboard` | Survey list (Clerk-gated when configured) |
| `/dashboard/[survey]` | Per-survey analytics |
| `/api/health` | Runtime configuration summary |
| `/api/export` | `format=csv\|json` responses, `format=contacts` emails |

---

## Authoring a survey

Create `surveys/my-survey.ts`, export a `SurveyDefinition`, register it in
`surveys/index.ts`, then run `npm run seed`.

```ts
import type { SurveyDefinition } from "@/lib/types";

export const mySurvey: SurveyDefinition = {
  id: "my-survey",
  title: "My survey",
  sections: ["About you"],
  collectsEmail: false,
  questions: [
    {
      id: "role",
      section: "About you",
      type: "single_select",
      prompt: "What do you do?",
      options: ["Engineering", "Design", "Other"],
    },
    {
      id: "stack",
      section: "About you",
      type: "multi_select",
      prompt: "Which of these do you use?",
      options: ["TypeScript", "Go", "Rust"],
      visibleWhen: { when: "role", equals: "Engineering" },  // engineers only
    },
  ],
};
```

Seeding is idempotent: it updates surveys and questions in place and deletes
questions you removed from the config. Responses are never touched.

The two bundled surveys are marked `example: true` so they're easy to find and
delete. `product-feedback` covers every question type; `event-signup` covers
`notOnly` gating, a nested `all` rule, and computed options.

### Question reference

| Field | Applies to | Notes |
| --- | --- | --- |
| `type` | all | `single_select`, `multi_select`, `scale`, `text`, `rank` |
| `help` | all | Rendered under the prompt |
| `options` | select / rank | Static choice list |
| `optionsFrom` | select | Choices computed from an earlier answer |
| `otherOption` | select | Label that reveals a free-text box |
| `layout` | multi_select | `chips` (short labels) or `cards` (sentences) |
| `visibleWhen` | all | Omit to always show |

---

## The privacy split

The analytics database holds surveys, questions, participants and responses.
The contacts database holds nothing but `participant_id → email`. Separate Turso
databases, separate credentials.

Three mechanisms enforce it:

1. `saveContact` in `lib/responses.ts` is the only function that writes personal
   data, and the only caller of `getContactsDb()`.
2. `getContactsDb()` throws when the analytics database is remote and no
   contacts database is configured — a misconfigured deployment refuses to
   collect email rather than quietly filing it in the wrong place. The check
   fires on a contact *write*, so a survey with `collectsEmail: false` needs
   only one database.
3. Open text runs through `lib/redact.ts` before persistence, stripping emails,
   phone numbers, SSNs, card numbers and URLs.

The responses API also drops answers for questions the survey doesn't define, so
a hand-crafted request can't write arbitrary rows.

---

## Deploying

```bash
npm run deploy
```

Pushes the app's environment variables to the Vercel project, then deploys. Needs
`VERCEL_TOKEN` and `VERCEL_PROJECT_ID` from `stripe projects env --pull`.

---

## Customize with AI

```bash
claude "Help me turn this into a real product. Follow prompts/starter-to-product.md."
codex  "Help me turn this into a real product. Follow prompts/starter-to-product.md."
```

The prompt tells the agent to read `AGENTS.md`, audit the starter, ask one
discovery question at a time, confirm the product name with you, work in phases
starting with the landing page, and preserve the privacy and provisioning wiring
while replacing everything else.

---

## Not included yet

`survey.mode` accepts `"chat"` and the types support a conversational interview,
but that runtime isn't built. Adding it means an LLM client (`openrouter/api` is
a Stripe Projects service), a `conversations` table, and transcript-to-answer
extraction. The schema is self-migrating, so it needs no migration.

---

## Maintaining this template

Only relevant if you're changing the template itself rather than building on it.

The app lives in this repo; the registry entry lives in Stripe's. To publish or
update:

1. Push to a public GitHub repo and pick the commit users should receive.
2. Fork [`stripe/projects-template-registry`](https://github.com/stripe/projects-template-registry).
3. Copy `projects-template.yaml` into it as `<category>/<variant>.yaml`, set
   `repo` to this repository and `ref` to the pinned commit.
4. Open a pull request and sign the CLA.

The registry entry is only an index record — your code stays here. If you change
the stack, update `services` and `tier_plans` in both copies.

`stripe projects catalog <provider> --json` is the source of truth for service
and plan slugs. Never guess one.

## License

MIT — see [LICENSE](LICENSE).
