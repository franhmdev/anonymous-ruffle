import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { InstallPromptListener } from "@/components/pwa/install-prompt";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorkerManager } from "@/components/pwa/service-worker";
import { getCurrentUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.description,
  applicationName: t.app.name,
  appleWebApp: { capable: true, title: t.app.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#b91c1c" },
    { media: "(prefers-color-scheme: dark)", color: "#14110f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request: the CSP nonce and the session require it.
  await connection();
  const user = await getCurrentUser();

  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 btn-primary"
        >
          {t.nav.skipToContent}
        </a>
        <OfflineBanner />
        <header className="border-b border-border bg-surface/80 pt-[env(safe-area-inset-top)] backdrop-blur">
          <nav className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3" aria-label="Principal">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand">
              <span aria-hidden="true">🎁</span> {t.app.name}
            </Link>
            {user ? (
              <Link href="/account" className="text-sm font-semibold underline-offset-4 hover:underline">
                {t.nav.account}
              </Link>
            ) : (
              <Link href="/login" className="text-sm font-semibold underline-offset-4 hover:underline">
                {t.nav.login}
              </Link>
            )}
          </nav>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
        >
          {children}
        </main>
        <footer className="mx-auto w-full max-w-2xl px-4 pb-6 text-center text-sm text-muted">
          <Link href="/privacy" className="underline underline-offset-4">
            {t.nav.privacy}
          </Link>
        </footer>
        <ServiceWorkerManager />
        <InstallPromptListener />
      </body>
    </html>
  );
}
