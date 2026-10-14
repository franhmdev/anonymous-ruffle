/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RouteMatchCallbackOptions,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Must match components/pwa/clear-private-caches.ts so logout can wipe them.
const PRIVATE_PAGES_CACHE = "ai-private-pages";
const STATIC_CACHE = "ai-static";

/**
 * Never cached by the service worker:
 * - draw results (`/groups/:id/match`, `/groups/:id/results`): privacy,
 * - critical operations that require a connection (invitations, login),
 * - API and Server Action requests.
 */
const NETWORK_ONLY_PATHS = [
  /^\/api\//,
  /^\/groups\/[^/]+\/(match|results)(\/|$)/,
  /^\/invite\//,
  /^\/login/,
  /^\/auth\//,
  /^\/account/,
];

const isNetworkOnly = ({ url, sameOrigin, request }: RouteMatchCallbackOptions) =>
  !sameOrigin ||
  request.method !== "GET" ||
  request.headers.has("Next-Action") ||
  NETWORK_ONLY_PATHS.some((pattern) => pattern.test(url.pathname));

const isStaticAsset = ({ url, request }: RouteMatchCallbackOptions) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  ["style", "script", "font", "image"].includes(request.destination);

// Group pages and wishlists: network first, falling back to the last copy for offline reading.
const isPage = ({ request }: RouteMatchCallbackOptions) =>
  request.mode === "navigate" || request.headers.get("RSC") === "1";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Updates wait for the user to tap "Actualizar" (SKIP_WAITING message).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    { matcher: isNetworkOnly, handler: new NetworkOnly() },
    {
      matcher: isStaticAsset,
      handler: new CacheFirst({
        cacheName: STATIC_CACHE,
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: isPage,
      handler: new NetworkFirst({
        cacheName: PRIVATE_PAGES_CACHE,
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 14 * 24 * 60 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

type PushPayload = { title: string; body: string; url: string; tag?: string };

self.addEventListener("push", (event) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    return;
  }
  if (!payload?.title) return;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  // Only open paths inside the app.
  const target = new URL(raw.startsWith("/") ? raw : "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
