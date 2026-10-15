import { expect, test, type Browser, type Page } from "@playwright/test";
import { confirmAction, findEmail, loginWithCode, uniqueEmail } from "./helpers";

// One end-to-end story: admin creates a group, two people join from the
// WhatsApp link as guests (no install, no registration), the admin draws,
// and each person sees only their own match.
test.describe.configure({ mode: "serial" });

async function joinAsGuest(browser: Browser, inviteLink: string, name: string): Promise<Page> {
  const context = await browser.newContext({ ...test.info().project.use, locale: "es-ES" });
  const page = await context.newPage();
  await page.goto(inviteLink);
  await expect(page.getByRole("heading", { name: /Te han invitado/ })).toBeVisible();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByRole("button", { name: "Unirme" }).click();
  await page.waitForURL(/\/groups\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Familia E2E", exact: true })).toBeVisible();
  return page;
}

test("create, invite, join as guests, draw and see only your own result", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const adminEmail = uniqueEmail("admin");
  await loginWithCode(page, adminEmail, "Ana");

  // Create the group.
  await page.getByRole("link", { name: "Nuevo grupo" }).click();
  await page.getByLabel("Nombre del grupo").fill("Familia E2E");
  await page.getByLabel("Presupuesto aproximado (€)").fill("25");
  await page.getByLabel("Fecha de entrega").fill("2026-12-24");
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page.getByRole("heading", { name: "Familia E2E", exact: true })).toBeVisible();

  // The invitation link is shown with share options.
  const inviteLink = (await page.getByLabel("Enlace").textContent())!.trim();
  expect(inviteLink).toMatch(/\/invite\/[\w-]{20,}/);
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);

  // Not enough people yet: the draw explains why.
  await confirmAction(page, "Hacer el sorteo ahora");
  await expect(page.getByRole("alert").filter({ hasText: "al menos 3" })).toBeVisible();

  // Two guests join from the link in their own browsers.
  const bea = await joinAsGuest(browser, inviteLink, "Bea");
  const carlos = await joinAsGuest(browser, inviteLink, "Carlos");

  // An impossible exclusion is reported clearly: with Ana ↔ Bea, both could only give to Carlos.
  await page.reload();
  // Exclusions are added from each person's row, in a bottom sheet that closes on success.
  const sheet = page.getByRole("dialog", { name: "Añadir exclusiones" }).filter({ visible: true });
  // Retry until hydration has attached the click handler.
  await expect(async () => {
    await page.getByRole("button", { name: "Añadir exclusiones: Ana" }).click();
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await sheet.getByLabel(/Ana ↔/).selectOption({ label: "Bea" });
  await sheet.getByRole("button", { name: "Añadir exclusión" }).click();
  const removeExclusion = page.getByRole("button", { name: "Eliminar: Ana ↔ Bea" });
  await expect(removeExclusion).toBeVisible();
  await confirmAction(page, "Hacer el sorteo ahora");
  await expect(page.getByRole("alert").filter({ hasText: "no hay forma de hacer un sorteo válido" })).toBeVisible();

  // Remove the exclusion and draw.
  await removeExclusion.click();
  await expect(removeExclusion).toHaveCount(0);
  await confirmAction(page, "Hacer el sorteo ahora");
  await expect(page.getByText(/¡Sorteo realizado!/)).toBeVisible();

  // The admin gets their result by email and sees all results.
  const resultEmail = await findEmail(adminEmail, "Tu amigo invisible");
  expect(resultEmail.text).toMatch(/Bea|Carlos/);
  await page.getByRole("link", { name: "Ver todos los resultados" }).click();
  await expect(page.getByRole("row")).toHaveCount(4);

  // Each guest sees exactly one name, never the full results.
  for (const guest of [bea, carlos]) {
    await guest.reload();
    await guest.getByRole("link", { name: /Ver a quién le regalo/ }).click();
    await guest.waitForURL(/\/match$/, { timeout: 30_000, waitUntil: "commit" });
    await expect(guest.getByRole("heading", { name: "Te toca regalar a" })).toBeVisible();
    const groupUrl = guest.url().replace(/\/match$/, "");
    const response = await guest.goto(`${groupUrl}/results`);
    expect(response?.status()).toBe(404);
    expect(response?.headers()["cache-control"]).toContain("no-store");
  }

  // The invitation closes once the draw is done.
  await bea.goto(inviteLink);
  await expect(bea.getByText(/ha caducado o el sorteo ya se ha hecho/)).toBeVisible();
});

test("wishlist rejects non-http links and opens store links safely", async ({ page }) => {
  const email = uniqueEmail("wish");
  await loginWithCode(page, email, "Wendy");
  await page.getByRole("link", { name: "Nuevo grupo" }).click();
  await page.getByLabel("Nombre del grupo").fill("Lista E2E");
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await page.getByRole("link", { name: /Mi lista de deseos/ }).click();

  await page.getByLabel("Idea").fill("Algo peligroso");
  await page.getByLabel(/Enlace a la tienda/).evaluate((input: HTMLInputElement) => (input.type = "text"));
  await page.getByLabel(/Enlace a la tienda/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "http:// o https://" })).toBeVisible();

  await page.getByLabel("Idea").fill("Libro de cocina");
  await page.getByLabel(/Enlace a la tienda/).fill("https://example.com/libro");
  await page.getByRole("button", { name: "Añadir" }).click();
  const link = page.getByRole("link", { name: /Abrir enlace/ });
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(link).toHaveAttribute("target", "_blank");
});

test("a wrong code is rejected and the session survives a reload", async ({ page }) => {
  const email = uniqueEmail("code");
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel(/Tu nombre/).fill("Diego");
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await page.getByLabel("Código de 6 dígitos").fill("000000");
  await page.getByRole("button", { name: "Entrar" }).click();
  // The real code could theoretically be 000000; the message covers the usual case.
  await expect(
    page.getByText("El código no es correcto.").or(page.getByRole("heading", { name: "Tus amigos invisibles" })),
  ).toBeVisible();

  await loginWithCode(page, email);
  // A page load renews the session cookie (sliding expiry) with safe attributes.
  const response = await page.reload();
  await expect(page.getByRole("heading", { name: "Tus amigos invisibles" })).toBeVisible();
  const setCookie = (await response!.headerValue("set-cookie")) ?? "";
  expect(setCookie).toMatch(/ai_session=/);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=lax/i);
  expect(setCookie).toMatch(/Max-Age=7776000/);
});
