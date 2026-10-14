// Builds public/sw.js after `next build` (Turbopack-compatible Serwist setup).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { serwist } from "@serwist/next/config";

const OFFLINE_PAGE = "public/offline.html";
const offlineRevision = createHash("sha256").update(readFileSync(OFFLINE_PAGE)).digest("hex").slice(0, 16);

export default serwist({
  swSrc: "worker/sw.ts",
  swDest: "public/sw.js",
  // Every page depends on the session, so no HTML is precached; only the
  // static app shell (JS, CSS, icons) and the offline fallback.
  precachePrerendered: false,
  // Serwist's Next.js transform maps public/*.html to "/public/<name>" (404),
  // which would make the whole install fail; precache it explicitly instead.
  globIgnores: [OFFLINE_PAGE],
  additionalPrecacheEntries: [{ url: "/offline.html", revision: offlineRevision }],
});
