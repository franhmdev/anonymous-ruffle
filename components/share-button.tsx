"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

type Props = { title: string; text: string; url: string };

/** Web Share API with WhatsApp and copy-to-clipboard fallbacks. */
export function ShareButton({ title, text, url }: Props) {
  const [copied, setCopied] = useState(false);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link stays visible for manual copy.
    }
  }

  return (
    <div className="space-y-2">
      <p className="break-all rounded-lg bg-background px-3 py-2 font-mono text-sm" aria-label="Enlace">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={share}>
          {t.common.share}
        </button>
        <a className="btn-secondary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <button type="button" className="btn-secondary" onClick={copy} aria-live="polite">
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
    </div>
  );
}
