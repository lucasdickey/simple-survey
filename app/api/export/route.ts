import { NextResponse } from "next/server";
import { clerkEnabled, getSessionUser } from "@/lib/auth";
import { getContactsDb, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Exports.
 *
 * `format=csv|json` returns response data from the analytics database.
 * `format=contacts` returns email addresses from the contacts database — kept
 * as a deliberately separate, explicitly requested export so PII is never
 * bundled into a routine response download.
 */

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

export async function GET(request: Request) {
  if (clerkEnabled && !(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const surveyId = url.searchParams.get("survey");
  const format = url.searchParams.get("format") ?? "csv";

  if (!surveyId) {
    return NextResponse.json({ error: "Missing `survey` parameter." }, { status: 400 });
  }

  if (format === "contacts") {
    const contacts = await getContactsDb();
    const rs = await contacts.execute({
      sql: `SELECT participant_id, survey_id, created_at, email, clerk_user_id
            FROM contacts WHERE survey_id = ? ORDER BY created_at ASC`,
      args: [surveyId],
    });
    const rows = rs.rows as unknown as Record<string, unknown>[];
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${surveyId}-contacts.csv"`,
      },
    });
  }

  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT r.participant_id, r.question_id, r.response_type, r.response_value,
                 r.created_at, p.completion_status, p.utm_source, p.utm_medium,
                 p.utm_campaign, p.referrer
          FROM responses r
          JOIN participants p ON p.participant_id = r.participant_id
          WHERE r.survey_id = ?
          ORDER BY r.participant_id, r.question_id`,
    args: [surveyId],
  });
  // Answers are stored JSON-encoded. Decode them so a spreadsheet shows
  // `In person` rather than `"""In person"""`, and `a, b` for multi-selects.
  const rows = (rs.rows as unknown as Record<string, unknown>[]).map((row) => {
    let value: unknown = row.response_value;
    try {
      value = JSON.parse(String(row.response_value));
    } catch {
      // Leave it as stored.
    }
    return { ...row, response_value: Array.isArray(value) ? value.join(" | ") : value };
  });

  if (format === "json") {
    return NextResponse.json({ survey: surveyId, count: rows.length, rows });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${surveyId}-responses.csv"`,
    },
  });
}
