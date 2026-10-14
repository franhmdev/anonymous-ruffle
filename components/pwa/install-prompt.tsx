"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "ai:install-dismissed";

// The browser fires `beforeinstallprompt` once, early; keep it until a moment with value.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Mounted once in the root layout to capture the install event. */
export function InstallPromptListener() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      deferredPrompt = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function useDeferredPrompt() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deferredPrompt,
    () => null,
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

/**
 * Suggests installing the app. Render it only after an action with value
 * (joining or creating a group), never on first load.
 */
export function InstallSuggestion() {
  const prompt = useDeferredPrompt();
  const platform = useSyncExternalStore(
    noopSubscribe,
    () => (isStandalone() ? "standalone" : isIos() ? "ios" : "other"),
    () => "server",
  );
  const storedDismissal = useSyncExternalStore(noopSubscribe, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);

  const mode =
    dismissed || storedDismissal || platform === "standalone" || platform === "server"
      ? "hidden"
      : platform === "ios"
        ? "ios"
        : prompt
          ? "prompt"
          : "hidden";

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage may be unavailable (private mode); just hide it.
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    deferredPrompt = null;
    notify();
  };

  if (mode === "hidden") return null;

  return (
    <aside className="card border-brand" aria-labelledby="install-title">
      <h2 id="install-title" className="text-lg font-bold">
        {t.pwa.installTitle}
      </h2>
      <p className="mt-1 text-sm">{mode === "ios" ? t.pwa.iosInstall : t.pwa.installBody}</p>
      <div className="mt-3 flex gap-2">
        {mode === "prompt" && (
          <button type="button" className="btn-primary" onClick={install}>
            {t.pwa.install}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={dismiss}>
          {t.pwa.dismiss}
        </button>
      </div>
    </aside>
  );
}
