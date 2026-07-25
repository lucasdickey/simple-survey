#!/usr/bin/env bash
#
# Provision this app's services with the Stripe Projects CLI.
#
# `stripe projects build` already runs the equivalent of this for you. Use this
# script when you cloned the repo directly, or to add a service later.
#
# Notes:
#   - Confirm every slug first: `stripe projects catalog <provider> --json`.
#     Never guess a provider/service slug.
#   - This script deliberately does NOT pass `--accept-tos`. You accept provider
#     terms yourself.
#   - Env var names are derived from `--name`, so `--name analytics-db` produces
#     ANALYTICS_DB_DATABASE_URL / ANALYTICS_DB_AUTH_TOKEN. `lib/turso-config.ts`
#     resolves across the likely names.
set -euo pipefail

command -v stripe >/dev/null 2>&1 || {
  echo "The Stripe CLI is not installed. See https://docs.stripe.com/stripe-cli" >&2
  exit 1
}

LOCATION="${TURSO_LOCATION:-$(curl -fsS https://region.turso.io | sed -n 's/.*"server":"\([^"]*\)".*/\1/p' || echo aws-us-east-1)}"
echo "Using Turso location: ${LOCATION}"

stripe projects init --yes

# Analytics database — surveys, questions, participants, responses. No PII.
stripe projects add turso/database --name analytics-db \
  --config "{\"name\":\"simple-survey\",\"location\":\"${LOCATION}\"}" --yes

# Contacts database — email addresses only, physically separate from responses.
# Required before any survey that collects email can accept a response.
stripe projects add turso/database --name contacts-db \
  --config "{\"name\":\"simple-survey-contacts\",\"location\":\"${LOCATION}\"}" --yes

# Auth — gates the dashboard. Survey routes stay public.
stripe projects add clerk/auth --name auth --yes

# Hosting.
stripe projects add vercel/project --name hosting --yes

# Optional: admin notification email when a response lands.
# stripe projects add twilio/email --name email --yes

stripe projects env --pull

cat <<'EOF'

Provisioned. Next:
  npm run seed     # write the example surveys into the database
  npm run dev      # then open http://localhost:3000
  curl localhost:3000/api/health   # confirm every flag flipped to true
EOF
