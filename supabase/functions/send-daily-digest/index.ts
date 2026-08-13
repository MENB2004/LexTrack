// @ts-nocheck
// Supabase Edge Function: send-daily-digest
// Sends a morning email digest of upcoming hearings to opted-in lawyers via Gmail SMTP.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const GMAIL_USER = Deno.env.get("GMAIL_USER") || "lextrack96@gmail.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Create reusable Nodemailer transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

Deno.serve(async (req: Request) => {
  try {
    // Validate secrets are present
    if (!GMAIL_APP_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables (GMAIL_APP_PASSWORD, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing secrets" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get all users who have opted into the daily digest
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, digest_enabled")
      .eq("digest_enabled", true);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch profiles" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log("No users opted into daily digest. Skipping.");
      return new Response(
        JSON.stringify({ message: "No subscribers", emailsSent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Calculate the date window: today → 7 days ahead
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    let emailsSent = 0;
    let errors: string[] = [];

    // 3. For each opted-in user, fetch their upcoming cases and send email
    for (const profile of profiles) {
      if (!profile.email) {
        console.warn(`Skipping user ${profile.id}: no email address`);
        continue;
      }

      // Fetch active cases with hearings in the next 7 days
      const { data: cases, error: casesError } = await supabase
        .from("cases")
        .select(
          "case_number, client_name, case_type, next_hearing_date, is_priority, court_name, courtroom, status"
        )
        .eq("user_id", profile.id)
        .eq("status", "Active")
        .gte("next_hearing_date", todayStr)
        .lte("next_hearing_date", nextWeekStr)
        .order("next_hearing_date", { ascending: true });

      if (casesError) {
        console.error(
          `Error fetching cases for user ${profile.id}:`,
          casesError.message
        );
        errors.push(`User ${profile.id}: ${casesError.message}`);
        continue;
      }

      if (!cases || cases.length === 0) {
        console.log(`No upcoming hearings for user ${profile.id}. Skipping.`);
        continue;
      }

      // Build the email HTML
      const lawyerName = profile.full_name || "Counselor";
      const emailHtml = buildDigestEmail(lawyerName, cases, todayStr);

      // Send via Gmail SMTP
      try {
        await transporter.sendMail({
          from: `"LexTrack Alerts" <${GMAIL_USER}>`,
          to: profile.email,
          subject: `⚖️ LexTrack Daily Digest — ${formatDateReadable(todayStr)}`,
          html: emailHtml,
        });

        emailsSent++;
        console.log(`✅ Digest sent via Gmail to ${profile.email}`);
      } catch (sendErr) {
        console.error(`❌ Failed to send to ${profile.email}:`, sendErr.message);
        errors.push(`${profile.email}: ${sendErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Daily digest completed",
        emailsSent,
        totalSubscribers: profiles.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in send-daily-digest:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// =============================================
// Helper: Build rich HTML email
// =============================================
interface CaseRow {
  case_number: string;
  client_name: string;
  case_type: string;
  next_hearing_date: string;
  is_priority: boolean;
  court_name?: string;
  courtroom?: string;
}

function buildDigestEmail(
  lawyerName: string,
  cases: CaseRow[],
  todayStr: string
): string {
  const priorityCases = cases.filter((c) => c.is_priority);
  const regularCases = cases.filter((c) => !c.is_priority);

  const buildCaseRow = (c: CaseRow) => {
    const hearingDate = formatDateReadable(c.next_hearing_date);
    const daysUntil = getDaysUntil(todayStr, c.next_hearing_date);
    const urgencyColor =
      daysUntil === 0
        ? "#ef4444"
        : daysUntil === 1
        ? "#f59e0b"
        : "#10b981";
    const urgencyLabel =
      daysUntil === 0
        ? "🔴 TODAY"
        : daysUntil === 1
        ? "🟡 TOMORROW"
        : `📅 In ${daysUntil} days`;
    const courtInfo = c.court_name
      ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">🏛 ${c.court_name}${c.courtroom ? ` — Room ${c.courtroom}` : ""}</div>`
      : "";

    return `
      <tr>
        <td style="padding:16px;border-bottom:1px solid #1e293b;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:700;color:#f1f5f9;font-size:15px;">
                ${c.is_priority ? "⭐ " : ""}${c.case_number}
              </div>
              <div style="color:#cbd5e1;font-size:13px;margin-top:4px;">
                👤 ${c.client_name} &nbsp;·&nbsp; 📂 ${c.case_type}
              </div>
              ${courtInfo}
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:600;color:${urgencyColor};">
                ${urgencyLabel}
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
                ${hearingDate}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  };

  const prioritySection =
    priorityCases.length > 0
      ? `
      <div style="background:#7c3aed20;border-left:4px solid #7c3aed;padding:12px 16px;margin-bottom:16px;border-radius:0 8px 8px 0;">
        <span style="color:#a78bfa;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
          ⚡ Priority Cases (${priorityCases.length})
        </span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        ${priorityCases.map(buildCaseRow).join("")}
      </table>
    `
      : "";

  const regularSection =
    regularCases.length > 0
      ? `
      <div style="background:#0ea5e920;border-left:4px solid #0ea5e9;padding:12px 16px;margin-bottom:16px;border-radius:0 8px 8px 0;">
        <span style="color:#38bdf8;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
          📋 Scheduled Hearings (${regularCases.length})
        </span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        ${regularCases.map(buildCaseRow).join("")}
      </table>
    `
      : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

        <!-- HEADER -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:28px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">
            ⚖️ LexTrack
          </div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">
            Daily Hearing Digest
          </div>
        </div>

        <!-- GREETING -->
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:24px;">
          <div style="font-size:18px;color:#f1f5f9;font-weight:600;">
            Good Morning, ${lawyerName} 👋
          </div>
          <div style="font-size:14px;color:#94a3b8;margin-top:8px;line-height:1.5;">
            You have <strong style="color:#38bdf8;">${cases.length} hearing${cases.length > 1 ? "s" : ""}</strong> 
            scheduled in the next 7 days. Here's your briefing:
          </div>
        </div>

        <!-- CASES -->
        ${prioritySection}
        ${regularSection}

        <!-- FOOTER -->
        <div style="text-align:center;padding-top:24px;border-top:1px solid #1e293b;">
          <div style="font-size:12px;color:#475569;line-height:1.6;">
            This email was sent by LexTrack Daily Digest via ${GMAIL_USER}.<br/>
            To stop receiving these emails, disable "Daily Digest Email" in LexTrack Settings.
          </div>
          <div style="font-size:11px;color:#334155;margin-top:12px;">
            © ${new Date().getFullYear()} LexTrack Counsel Portal
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
}

// =============================================
// Helper: Format date as "13 Aug 2026"
// =============================================
function formatDateReadable(dateStr: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// =============================================
// Helper: Calculate days until hearing
// =============================================
function getDaysUntil(todayStr: string, hearingStr: string): number {
  const today = new Date(todayStr + "T00:00:00Z");
  const hearing = new Date(hearingStr + "T00:00:00Z");
  return Math.round(
    (hearing.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}
