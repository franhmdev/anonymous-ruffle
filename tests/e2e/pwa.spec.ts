import { expect, test } from "@playwright/test";

test("serves an installable web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Amigo Invisible",
    display: "standalone",
    lang: "es",
    start_url: "/?source=pwa",
  });
  expect(manifest.theme_color).toBeTruthy();
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain("maskable");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("sends security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});

test("landing page is in Spanish and links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("link", { name: "Empezar" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("cron endpoint rejects requests without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/draws")).status()).toBe(401);
  expect((await request.get("/api/cron/draws", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
});
