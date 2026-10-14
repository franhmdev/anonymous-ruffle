"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

/**
 * Registers the service worker and shows an "Actualizar" banner when a new
 * version is waiting, instead of reloading the app without warning.
 */
export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | undefined;
    let reloading = false;

    const trackInstalling = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
      });
    };

    // The first install also changes the controller (clientsClaim); only reload
    // when the user asked for the update.
    const onControllerChange = () => {
      if (reloading || !updateRequested.current) return;
      reloading = true;
      window.location.reload();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        trackInstalling(reg.installing);
        reg.addEventListener("updatefound", () => trackInstalling(reg.installing));
      })
      .catch((error) => console.warn("Service worker registration failed", error));

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg"
    >
      <span className="text-sm font-medium">{t.pwa.updateAvailable}</span>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          updateRequested.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        {t.pwa.update}
      </button>
    </div>
  );
}
