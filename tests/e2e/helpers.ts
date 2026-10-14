import { existsSync, readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { OUTBOX_FILE } from "../../playwright.config";

type OutboxEmail = { to: string; subject: string; text: string };

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function readOutbox(): OutboxEmail[] {
  if (!existsSync(OUTBOX_FILE)) return [];
  return readFileSync(OUTBOX_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxEmail);
}

/** Waits for the dev mailer to write the login code for this address. */
export async function readLoginCode(email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      () => {
        const message = readOutbox()
          .filter((m) => m.to === email && m.subject.includes("código"))
          .at(-1);
        code = message?.subject.match(/(\d{6})/)?.[1];
        return code;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return code!;
}

export async function findEmail(email: string, subjectIncludes: string): Promise<OutboxEmail> {
  let found: OutboxEmail | undefined;
  await expect
    .poll(
      () => {
        found = readOutbox().find((m) => m.to === email && m.subject.includes(subjectIncludes));
        return found;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return found!;
}

/** Full passwordless login with the 6-digit code typed inside the app (the iOS-friendly path). */
export async function loginWithCode(page: Page, email: string, name?: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  if (name) await page.getByLabel(/Tu nombre/).fill(name);
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await expect(page.getByRole("heading", { name: "Introduce el código" })).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill(await readLoginCode(email));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Mis grupos" })).toBeVisible();
}

/** Clicks a two-step confirm button, then confirms. */
export async function confirmAction(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();
}
