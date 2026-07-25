/**
 * Deploy to Vercel using the credentials `stripe projects env --pull` wrote.
 *
 * Two steps: push the app's own env vars up to the Vercel project (so the
 * deployed app can reach Turso, Clerk, and Twilio), then deploy.
 *
 * Expects VERCEL_TOKEN and VERCEL_PROJECT_ID; VERCEL_ORG_ID / VERCEL_TEAM_ID
 * are used when the project lives under a team.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

/** Vercel manages these itself — pushing them back would corrupt the project. */
const DENYLIST = new Set([
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_PROJECT_LINK",
  "VERCEL_PROJECT_URL",
  "VERCEL_URL",
]);

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
}

const envValues = {
  ...parseEnvFile(path.join(rootDir, ".env")),
  ...parseEnvFile(path.join(rootDir, ".env.local")),
};

const token = process.env.VERCEL_TOKEN?.trim() || envValues.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID?.trim() || envValues.VERCEL_PROJECT_ID;
const teamId =
  process.env.VERCEL_TEAM_ID?.trim() ||
  envValues.VERCEL_TEAM_ID ||
  process.env.VERCEL_ORG_ID?.trim() ||
  envValues.VERCEL_ORG_ID;

if (!token) {
  console.error(
    "Missing VERCEL_TOKEN. Run `stripe projects add vercel/project` then `stripe projects env --pull`.",
  );
  process.exit(1);
}

const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

async function pushEnvVar(key, value) {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env${teamQuery}${teamQuery ? "&" : "?"}upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        value,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn(`  ! ${key}: ${response.status} ${detail.slice(0, 200)}`);
    return false;
  }
  return true;
}

if (projectId) {
  const keys = Object.keys(envValues).filter(
    (key) => !DENYLIST.has(key) && envValues[key] !== "",
  );
  console.log(`Syncing ${keys.length} environment variables to Vercel…`);
  for (const key of keys) {
    const ok = await pushEnvVar(key, envValues[key]);
    if (ok) console.log(`  ✓ ${key}`);
  }
} else {
  console.warn("No VERCEL_PROJECT_ID found — skipping environment sync.");
}

console.log("\nDeploying…");
const args = ["vercel@latest", "deploy", "--prod", "--yes", `--token=${token}`];
const result = spawnSync("npx", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    VERCEL_ORG_ID: teamId ?? process.env.VERCEL_ORG_ID,
    VERCEL_PROJECT_ID: projectId ?? process.env.VERCEL_PROJECT_ID,
  },
});

process.exit(result.status ?? 1);
