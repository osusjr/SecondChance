// ============================================================================
// SecondChance Collective — notify-email Edge Function
//
// Sends an email copy of every in-app notification through Brevo.
// Wired up by a Database Webhook: INSERT on public.notifications → this
// function. See SETUP.md, "Email copies of notifications".
//
// Secrets it needs (Edge Functions → notify-email → Secrets):
//   BREVO_API_KEY   — the Brevo API key (starts xkeysib-, NOT the SMTP key)
//   SENDER_EMAIL    — the sender you verified in Brevo
//   SITE_URL        — optional; the deployed site, for links in the email
//   WEBHOOK_SECRET  — optional; must match the x-webhook-secret header the
//                     webhook sends, so only Supabase can invoke this
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let record: Record<string, unknown> | null = null;
  try {
    const payload = await req.json();
    if (payload?.type && payload.type !== "INSERT") return Response.json({ skipped: payload.type });
    record = payload?.record ?? null;
  } catch {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }
  if (!record?.user_id || !record?.title) return Response.json({ skipped: "no record" });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: person } = await supa
    .from("profiles")
    .select("email, full_name, username, account_status")
    .eq("id", record.user_id)
    .maybeSingle();
  if (!person?.email || person.account_status === "blocked") {
    return Response.json({ skipped: "no email" });
  }

  const site = (Deno.env.get("SITE_URL") ?? "https://secondchance-xi.vercel.app").replace(/\/$/, "");
  const link = record.link_url
    ? `${site}/${String(record.link_url).replace(/^\//, "")}`
    : `${site}/account.html?tab=notifications`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#101114">
      <p style="font-size:15px;font-weight:700;letter-spacing:-.02em;margin:0 0 18px">
        SecondChance <span style="color:#8a8f98;font-weight:500">collective.</span></p>
      <h1 style="font-size:19px;margin:0 0 10px">${esc(record.title)}</h1>
      ${record.body ? `<p style="font-size:14.5px;line-height:1.6;color:#3d4149;margin:0 0 18px">${esc(record.body)}</p>` : ""}
      <p style="margin:22px 0">
        <a href="${esc(link)}"
           style="background:#101114;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:14px">
          View on SecondChance</a></p>
      <p style="font-size:12px;color:#8a8f98;margin-top:26px">
        You are getting this because it also appeared in your SecondChance notifications.</p>
    </div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": Deno.env.get("BREVO_API_KEY")!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SecondChance Collective", email: Deno.env.get("SENDER_EMAIL")! },
      to: [{ email: person.email, name: person.full_name ?? person.username ?? undefined }],
      subject: String(record.title),
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("brevo rejected:", res.status, detail);
    return Response.json({ error: "send failed", status: res.status }, { status: 502 });
  }
  return Response.json({ sent: true });
});
