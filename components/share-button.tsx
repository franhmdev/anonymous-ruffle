"use client";

import { useState, type ReactNode } from "react";
import { ShareIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

type ShareData = { title: string; text: string; url: string };

const whatsappUrl = ({ text, url }: ShareData) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

/** Web Share API, falling back to a WhatsApp link when it is not available. */
async function share(data: ShareData) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  window.open(whatsappUrl(data), "_blank", "noopener,noreferrer");
}

/** Link preview with share, WhatsApp and copy buttons. */
export function ShareButton(data: ShareData) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link stays visible for manual copy.
    }
  }

  return (
    <div className="space-y-3">
      <p className="break-all rounded-2xl bg-background px-4 py-3 font-mono text-sm" aria-label="Enlace">
        {data.url}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-primary px-3" onClick={() => share(data)}>
          {t.common.share}
        </button>
        <a className="btn-secondary px-3" href={whatsappUrl(data)} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <button type="button" className="btn-secondary px-3" onClick={copy} aria-live="polite">
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
    </div>
  );
}

/** Single full-width share button (used in the group options sheet). */
export function ShareAction({ children, ...data }: ShareData & { children: ReactNode }) {
  return (
    <button type="button" className="btn-secondary w-full text-lg" onClick={() => share(data)}>
      <ShareIcon size={20} /> {children}
    </button>
  );
}
