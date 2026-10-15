import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { connection } from "next/server";
import { InstallPromptListener } from "@/components/pwa/install-prompt";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorkerManager } from "@/components/pwa/service-worker";
import { t } from "@/lib/i18n";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.description,
  applicationName: t.app.name,
  appleWebApp: { capable: true, title: t.app.shortName, statusBarStyle: "black-translucent" },
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
    { media: "(prefers-color-scheme: light)", color: "#6c8ef5" },
    { media: "(prefers-color-scheme: dark)", color: "#2f3f86" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered per request: the CSP nonce and the session require it.
  await connection();

  return (
    <html lang="es" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 btn-primary"
        >
          {t.nav.skipToContent}
        </a>
        <OfflineBanner />
        {children}
        <ServiceWorkerManager />
        <InstallPromptListener />
      </body>
    </html>
  );
}
