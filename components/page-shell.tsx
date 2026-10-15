import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon, GiftIcon, SettingsIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

type Props = {
  children: ReactNode;
  /** Shows a back button to this path instead of the logo. */
  back?: string;
  /** Large white title on the blue area. */
  title?: ReactNode;
  /** Right-side header control. Defaults to the settings link when `settings` is true. */
  action?: ReactNode;
  settings?: boolean;
  /**
   * `full`: the whole page is blue (home).
   * `hero`: blue header band; `overlap` content sits half over it, the rest on the light background.
   */
  tone?: "full" | "hero";
  overlap?: ReactNode;
};

export function PageShell({ children, back, title, action, settings = false, tone = "hero", overlap }: Props) {
  const header = (
    <div className="relative mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      {back ? (
        <Link href={back} className="btn-icon" aria-label={t.common.back}>
          <ArrowLeftIcon />
        </Link>
      ) : (
        <Link href="/" className="text-white" aria-label={t.app.name}>
          <GiftIcon size={44} strokeWidth={1.8} />
        </Link>
      )}
      {back && (
        <span className="absolute left-1/2 -translate-x-1/2 text-white">
          <GiftIcon size={44} strokeWidth={1.8} />
        </span>
      )}
      {action ??
        (settings ? (
          <Link href="/account" className="btn-icon" aria-label={t.nav.account}>
            <SettingsIcon />
          </Link>
        ) : (
          <span className="size-12" />
        ))}
    </div>
  );

  if (tone === "full") {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-hero">
        <Decoration />
        {header}
        <main id="main" className="relative mx-auto w-full max-w-xl px-5 pb-48 pt-8">
          {title && <h1 className="mb-6 text-3xl font-black text-white">{title}</h1>}
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className={`relative overflow-hidden bg-hero ${overlap ? "pb-24" : "pb-10"}`}>
        <Decoration />
        {header}
        {title && (
          <div className="relative mx-auto mt-6 max-w-xl px-5 text-center">
            <h1 className="inline-block rounded-2xl bg-black/10 px-6 py-2 text-2xl font-black text-white text-balance">
              {title}
            </h1>
          </div>
        )}
      </div>
      <main
        id="main"
        className="relative mx-auto w-full max-w-xl space-y-6 px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
      >
        {overlap ? <div className="-mt-20">{overlap}</div> : <div className="pt-6" />}
        {children}
      </main>
    </div>
  );
}

/** Large faint ribbon shapes in the blue background. */
function Decoration() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-10 h-[420px] w-[420px] text-white/10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 5.5 12 8c0-2.5 2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
