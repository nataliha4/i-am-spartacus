import { html } from "hono/html";
import { policyConfiguration } from "./public-config";

export async function policyPage(path: string) {
  let policy: ReturnType<typeof policyConfiguration>;
  try {
    policy = policyConfiguration();
  } catch {
    return new Response(
      "The operator has not configured the public policy yet.",
      { status: 503 },
    );
  }
  const privacy = path === "/privacy";
  const content = privacy
    ? html`
        <h2>Data and purpose</h2>
        <p>
          We store your Google account identifier, name, verified email, and the
          health and activity records you choose to enter, to provide your
          private tracker across devices. Google handles sign-in and receives
          the sign-in request; we request only basic identity information
          (openid, email and profile). We do not send tracker records to Google,
          display Google avatars, or retain Google access, refresh or ID tokens
          after sign-in.
        </p>
        <p>
          The app uses an essential session cookie. Installed apps cache static
          assets, not authenticated API responses. Tracker data is held in page
          memory while you use the app. Exports you download and data in the old
          browser-only tracker remain under your control.
        </p>
        <h2>Access and retention</h2>
        <p>
          Your tracker is private to your account. The service operator and
          infrastructure providers may access stored data to operate, secure,
          restore or support the service. This app includes no advertising or
          analytics integrations.
        </p>
        <p>
          We retain account and tracker records until you delete the account or
          ask the operator to remove it. Inactive accounts are not automatically
          deleted. Sessions expire after 14 days; expired sessions and OAuth
          state are periodically removed. Mutation retry receipts expire after 7
          days. Expired rate-limit records are periodically removed, normally
          within an hour; those counters can temporarily contain IP addresses or
          IPv6 subnet prefixes. Sessions include IP and browser metadata.
        </p>
        <p>
          Operational request logs contain request identifiers, routes, response
          status and timing; the application does not log request bodies,
          cookies or OAuth query strings. The operator retains operational logs
          for up to ${policy.logDays} days and backups for up to
          ${policy.backupDays} days. Infrastructure access logs must follow the
          same policy.
        </p>
        <h2>Your controls</h2>
        <p>
          Use Account &amp; data to download your records or permanently delete
          your account. Deletion removes the account, tracker, linked logins and
          sessions from the live database immediately. Copies in backups expire
          within the backup retention period; if a backup is restored, the
          operator must reapply deletion requests before reopening access.
          Downloaded exports and old browser storage are not removed by account
          deletion.
        </p>
        <p>
          For access, correction, deletion, or privacy questions, contact
          <a href="mailto:${policy.contact}">${policy.contact}</a>. Do not
          include sensitive tracker records in an initial email.
        </p>
      `
    : html`
        <h2>Using the tracker</h2>
        <p>
          I AM SPARTACUS is a personal health and activity journal. It does not
          provide medical advice, diagnosis or emergency services. You remain
          responsible for decisions you make using your records.
        </p>
        <p>
          Sign in with a Google account you control. Keep your account secure
          and enter only information you have permission to store. Do not abuse
          registration, bypass limits, access another person's data or disrupt
          the service.
        </p>
        <h2>Availability and limits</h2>
        <p>
          Signup is open while account capacity is available (initially 100
          accounts). Each tracker is limited to 50,000 records and 5 MiB of
          stored JSON data. Imports must fit within a 4 MiB request. The service
          requires an internet connection and may be unavailable during
          maintenance. Download exports if you need an independent copy of your
          records.
        </p>
        <p>
          The operator may restrict abusive use or change service availability
          and limits. You can export your data and delete your account in
          Account &amp; data. Inactive accounts are not automatically deleted.
          See the <a href="/privacy">privacy notice</a> for retention and
          contact information.
        </p>
        <p>
          Questions about the service:
          <a href="mailto:${policy.contact}">${policy.contact}</a>.
        </p>
      `;
  return new Response(
    await html`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${privacy ? "Privacy" : "Terms"} — I AM SPARTACUS</title>
          <link rel="stylesheet" href="/legal.css" />
        </head>
        <body>
          <main>
            <nav>
              <a href="/">Tracker</a> · <a href="/privacy">Privacy</a> ·
              <a href="/terms">Terms</a>
            </nav>
            <h1>${privacy ? "Privacy and retention" : "Terms of use"}</h1>
            <p>Operated by ${policy.operator}. Effective September 12, 2026.</p>
            ${content}
          </main>
        </body>
      </html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
