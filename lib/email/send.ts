import "server-only";
import { appendFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Prevents duplicates when a send is retried (by us or by the cron). Only Resend supports it. */
  idempotencyKey?: string;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

/** One attempt to deliver a message; throws on failure. */
type Transport = { name: string; send: (message: EmailMessage) => Promise<void> };

let cachedTransport: Transport | null | undefined;

/**
 * Chooses how emails leave the app:
 * - SMTP (e.g. Gmail with an app password) when SMTP_HOST is set,
 * - Resend when RESEND_API_KEY is set (needs a verified domain to reach anyone),
 * - otherwise none (development prints the email instead).
 */
function transport(): Transport | null {
  if (cachedTransport !== undefined) return cachedTransport;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    const smtp: Transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    cachedTransport = {
      name: "smtp",
      send: async (message) => {
        await smtp.sendMail({
          from: env.EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      },
    };
  } else if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    cachedTransport = {
      name: "resend",
      send: async (message) => {
        const { error } = await resend.emails.send(
          { from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text, html: message.html },
          message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
        );
        if (error) throw new Error(error.message);
      },
    };
  } else {
    cachedTransport = null;
  }
  return cachedTransport;
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
  const active = transport();
  if (!active) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] no email transport configured (SMTP_* or RESEND_API_KEY); email not sent", {
        to: maskEmail(message.to),
      });
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
      await active.send(message);
      return true;
    } catch (error) {
      console.warn("[email] send failed", {
        transport: active.name,
        attempt,
        to: maskEmail(message.to),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (attempt < MAX_ATTEMPTS) await sleep(BASE_DELAY_MS * 3 ** (attempt - 1));
  }
  console.error("[email] giving up after retries", { transport: active.name, to: maskEmail(message.to) });
  return false;
}

/** Sends several emails and returns how many failed. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  const results = await Promise.all(messages.map(sendEmail));
  return results.filter((ok) => !ok).length;
}
