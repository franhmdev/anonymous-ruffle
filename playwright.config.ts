import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export const OUTBOX_FILE = path.resolve(".e2e-outbox.jsonl");

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // The dev server compiles routes on first hit; give assertions room.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: { baseURL, trace: "on-first-retry", locale: "es-ES" },
  projects: [
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "ios-safari", use: { ...devices["iPhone 15"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        env: { DEV_OUTBOX_FILE: OUTBOX_FILE },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
