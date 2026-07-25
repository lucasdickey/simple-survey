# Simple Survey

Config-driven surveys with conditional logic, anonymous responses, and an
analytics dashboard — packaged as a [Stripe Projects](https://docs.stripe.com/projects)
build template.

```bash
stripe projects build   # then pick "Simple Survey"
```

## What this starter gives you

- **Surveys as data.** Question sets are typed config in `surveys/*.ts`, seeded
  into the database, and rendered generically. Nothing in the runtime knows
  about any particular survey.
- **Declarative conditional logic.** A question carries a `visibleWhen` rule
  evaluated against the answers so far — `includesAny`, `equals`, `notOnly`,
  `lte`/`gte`, and `all`/`any`/`not` combinators. No branching in components.
- **Computed options.** A question's choices can be derived from an earlier
  answer via `optionsFrom`.
- **Privacy by construction.** Two physically separate databases: responses in
  one, email addresses in the other. Open text is redacted before it is stored,
  and the app fails closed rather than co-locating personal data.
- **Every provider optional.** Runs on a local SQLite file with no keys at all.
- **Five question types.** `single_select`, `multi_select` (chips or cards),
  `scale`, `text`, `rank` — plus an "other" free-text escape hatch.
- **Analytics that follow the config.** Tallies, distributions, and text samples
  by default; a survey can declare score batteries and segment cuts and get
  relevant charts without any hardcoding.
- **CSV / JSON export**, with contact export kept deliberately separate.

## Quick start

```bash
npm install
npm run seed     # write the two example surveys into the database
npm run dev
```

Open http://localhost:3000. With no environment variables set, the app uses
`local.db` and `local-contacts.db`, and the dashboard is unprotected.

## Provisioning

`stripe projects build` does this for you. To do it by hand:

```bash
./scripts/provision.sh
```

That runs, in order:

```bash
stripe projects init
stripe projects add turso/database --name analytics-db   # responses, no PII
stripe projects add turso/database --name contacts-db    # email only
stripe projects add clerk/auth     --name auth
stripe projects add vercel/project --name hosting
stripe projects env --pull
```

Then confirm everything landed:

```bash
curl localhost:3000/api/health
```

Every flag should read `true` without you renaming a single environment
variable. The CLI names credentials after the resource (`--name analytics-db` →
`ANALYTICS_DB_DATABASE_URL`), so `lib/turso-config.ts` and `lib/clerk-config.ts`
resolve across the plausible spellings rather than betting on one.

Optional:

```bash
stripe projects add twilio/email --name email   # admin notification on submit
```

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

## Authoring a survey

Create `surveys/my-survey.ts`, export a `SurveyDefinition`, register it in
`surveys/index.ts`, and run `npm run seed`.

```ts
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
      // Only asked of engineers.
      visibleWhen: { when: "role", equals: "Engineering" },
    },
  ],
};
```

Seeding is idempotent: it updates surveys and questions in place and deletes
questions removed from the config. Responses are never touched.

## The privacy split

The analytics database holds surveys, questions, participants, and responses.
The contacts database holds nothing but `participant_id → email`. They are
separate Turso databases with separate credentials.

Two mechanisms enforce it:

1. `saveContact` in `lib/responses.ts` is the only function that writes personal
   data, and the only caller of `getContactsDb()`.
2. `getContactsDb()` throws when the analytics database is remote and no
   contacts database is configured — so a misconfigured deployment refuses to
   collect email rather than quietly storing it in the wrong place.

Open-text answers are additionally run through `lib/redact.ts` before being
persisted, which strips emails, phone numbers, SSNs, card numbers, and URLs.

A survey that sets `collectsEmail: false` never touches the contacts database
and needs only one Turso database.

## Deploying

```bash
npm run deploy
```

This pushes the app's environment variables to the Vercel project and deploys.
It needs `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` from
`stripe projects env --pull`.

## Customize with AI

```bash
claude "Help me turn this into a real product. Follow prompts/starter-to-product.md."
codex  "Help me turn this into a real product. Follow prompts/starter-to-product.md."
```

The prompt tells the agent to read `AGENTS.md`, audit the starter, ask one
discovery question at a time, confirm the product name with you, work in phases
starting with the landing page, and preserve the privacy and provisioning wiring
while replacing everything else.

## Publishing this template

The app lives here; the registry entry lives in Stripe's repo.

1. Push to a public GitHub repo and pick the commit users should receive.
2. Fork [`stripe/projects-template-registry`](https://github.com/stripe/projects-template-registry).
3. Copy `projects-template.yaml` to `<category>/<variant>.yaml` there, set
   `repo` to this repository and `ref` to the pinned commit.
4. Open a pull request.

The registry entry is only an index record — the code stays in this repo.

## Not included yet

`survey.mode` accepts `"chat"` and the types support it, but the conversational
interview runtime is not built. Adding it means an LLM client
(`openrouter/api` is a Stripe Projects service), a `conversations` table, and
transcript-to-answer extraction. The schema is self-migrating, so it needs no
migration.
