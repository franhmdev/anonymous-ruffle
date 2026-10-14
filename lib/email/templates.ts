import { format, formatBudget, formatDate, t } from "@/lib/i18n";

type Rendered = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds a simple, accessible email. Every paragraph is plain text and gets escaped. */
function layout(
  subject: string,
  paragraphs: string[],
  action?: { label: string; url: string },
  highlight?: string,
): Rendered {
  const textParts = [...paragraphs];
  if (highlight) textParts.splice(1, 0, highlight);
  if (action) textParts.push(`${action.label}: ${action.url}`);
  textParts.push(t.email.footer);

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:24px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:bold;color:#b91c1c;padding-bottom:16px">🎁 ${escapeHtml(t.app.name)}</td></tr>
${paragraphs
  .map((p, i) => {
    const row = `<tr><td style="font-size:16px;line-height:1.5;padding-bottom:12px">${escapeHtml(p)}</td></tr>`;
    return i === 0 && highlight
      ? `${row}<tr><td style="font-size:26px;font-weight:bold;letter-spacing:2px;text-align:center;padding:12px 0 20px">${escapeHtml(highlight)}</td></tr>`
      : row;
  })
  .join("\n")}
${
  action
    ? `<tr><td align="center" style="padding:12px 0 20px"><a href="${escapeHtml(action.url)}" style="background:#b91c1c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(action.label)}</a></td></tr>`
    : ""
}
<tr><td style="font-size:12px;color:#6b7280;padding-top:12px;border-top:1px solid #e5e7eb">${escapeHtml(t.email.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text: textParts.join("\n\n"), html };
}

export function loginCodeEmail(code: string, magicLink: string): Rendered {
  const e = t.email.loginCode;
  return layout(format(e.subject, { code }), [e.intro, e.expiry, e.ignore], { label: e.action, url: magicLink }, code);
}

export function invitationEmail(params: { groupName: string; adminName: string; link: string }): Rendered {
  const e = t.email.invitation;
  return layout(
    format(e.subject, { group: params.groupName }),
    [format(e.intro, { admin: params.adminName, group: params.groupName }), e.note],
    {
      label: e.action,
      url: params.link,
    },
  );
}

export function drawResultEmail(params: {
  name: string;
  groupName: string;
  receiverName: string;
  budget: number | null;
  deliveryDate: string | null;
  link: string;
}): Rendered {
  const e = t.email.drawResult;
  return layout(
    format(e.subject, { group: params.groupName }),
    [
      format(e.greeting, { name: params.name, group: params.groupName }),
      format(e.details, { budget: formatBudget(params.budget), date: formatDate(params.deliveryDate) }),
      e.secret,
    ],
    { label: e.action, url: params.link },
    params.receiverName,
  );
}

export function drawInvalidatedEmail(params: { groupName: string; link: string }): Rendered {
  const e = t.email.drawInvalidated;
  return layout(format(e.subject, { group: params.groupName }), [format(e.body, { group: params.groupName })], {
    label: e.action,
    url: params.link,
  });
}

export function scheduledDrawFailedEmail(params: { groupName: string; reason: string; link: string }): Rendered {
  const e = t.email.scheduledDrawFailed;
  return layout(
    format(e.subject, { group: params.groupName }),
    [format(e.body, { group: params.groupName }), params.reason, e.next],
    { label: e.action, url: params.link },
  );
}
