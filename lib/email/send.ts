import "server-only";
import { appendFileSync } from "node:fs";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Prevents duplicates when a send is retried (by us or by the cron). */
  idempotencyKey?: string;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

let client: Resend | null = null;

function resend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Sends an email with retries and exponential backoff. Failures are logged and
 * reported through the return value; callers decide whether to surface them.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const api = resend();
  if (!api) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY is not configured; email not sent", { to: maskEmail(message.to) });
      return false;
    }
    console.info(`\n[email:dev] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    // Lets e2e tests read login codes in development.
    if (process.env.DEV_OUTBOX_FILE) {
      appendFileSync(
        process.env.DEV_OUTBOX_FILE,
        `${JSON.stringify({ to: message.to, subject: message.subject, text: message.text })}\n`,
      );
    }
    return true;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await api.emails.send(
        { from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text, html: message.html },
        message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
      );
      if (!error) return true;
      console.warn("[email] send failed", { attempt, to: maskEmail(message.to), error: error.message });
    } catch (error) {
      console.warn("[email] send threw", { attempt, to: maskEmail(message.to), error: String(error) });
    }
    if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 3 ** (attempt - 1));
  }
  console.error("[email] giving up after retries", { to: maskEmail(message.to), subject: message.subject });
  return false;
}

/** Sends several emails and returns how many failed. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  const results = await Promise.all(messages.map(sendEmail));
  return results.filter((ok) => !ok).length;
}
