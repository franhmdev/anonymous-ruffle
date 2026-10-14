import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Amigo Invisible <no-reply@example.com>"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  APP_URL: z.url().default("http://localhost:3000"),
});

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

// Lazy so that `next build` does not require runtime secrets.
export const env = new Proxy({} as Env, {
  get(_target, key: string) {
    cached ??= load();
    return cached[key as keyof Env];
  },
});

export function appUrl(path: string): string {
  return new URL(path, env.APP_URL).toString();
}
