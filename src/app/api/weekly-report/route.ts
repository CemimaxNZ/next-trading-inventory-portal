import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildWeeklyReportHtml, buildWeeklyReportText, getEmailRecipients, loadWeeklyReportData } from "@/lib/weekly-report";

const REPORT_TIME_ZONE = process.env.WEEKLY_REPORT_TIME_ZONE ?? "Pacific/Auckland";

function getLocalDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: REPORT_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isScheduledReportTime(date = new Date()) {
  const local = getLocalDateParts(date);
  return local.weekday === "Mon" && Number(local.hour) === 2 && Number(local.minute) === 0;
}

async function sendWeeklyReport() {
  const recipients = getEmailRecipients();

  if (recipients.length === 0) {
    return { sent: false, reason: "No recipients configured." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.WEEKLY_REPORT_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "Missing RESEND_API_KEY or WEEKLY_REPORT_FROM_EMAIL." };
  }

  const supabase = createAdminSupabaseClient();
  const report = await loadWeeklyReportData(supabase);
  const html = buildWeeklyReportHtml(report);
  const text = buildWeeklyReportText(report);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipients,
      subject: `Weekly Inventory Report - ${new Date().toISOString().slice(0, 10)}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Resend request failed: ${message}`);
  }

  return { sent: true };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && !isScheduledReportTime()) {
    return NextResponse.json({
      sent: false,
      skipped: true,
      reason: `Waiting for Monday 2:00 AM in ${REPORT_TIME_ZONE}.`,
    });
  }

  const result = await sendWeeklyReport();
  return NextResponse.json(result);
}
