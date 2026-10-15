"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type Status = "loading" | "unsupported" | "ios-not-installed" | "denied" | "off" | "on";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Opt-in Web Push. Only asks for permission after an explicit tap. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setStatus(ios && !standalone ? "ios-not-installed" : "unsupported");
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  if (!publicKey) return <p className="hint">{t.push.notConfigured}</p>;

  async function enable() {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey!),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("on");
    } catch {
      setError(t.errors.generic);
    }
  }

  async function disable() {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError(t.errors.generic);
    }
  }

  return (
    <div className="space-y-2">
      <p className="hint">{t.push.explanation}</p>
      {status === "unsupported" && <p className="text-sm">{t.push.unsupported}</p>}
      {status === "ios-not-installed" && <p className="text-sm">{t.push.iosHint}</p>}
      {status === "denied" && <p className="text-sm">{t.push.denied}</p>}
      {status === "off" && (
        <button type="button" className="btn-secondary" onClick={enable}>
          {t.push.enable}
        </button>
      )}
      {status === "on" && (
        <>
          <p className="text-sm font-bold text-accent">{t.push.enabled}</p>
          <button type="button" className="btn-secondary" onClick={disable}>
            {t.push.disable}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
