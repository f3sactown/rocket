import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { AuthProvider } from "@/components/auth-provider";
import { FaviconSync } from "@/components/favicon-sync";
import { LaunchSplash } from "@/components/launch-splash";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rocket",
  description: "Tools for F3 PAX, starting with backblasts.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070a10" },
    { media: "(prefers-color-scheme: light)", color: "#eceef2" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The theme script sets data-theme before React loads.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-2 py-6 sm:gap-6 sm:px-4 sm:py-16">
          <AuthProvider>
            <FaviconSync />
            <LaunchSplash />
            <AppNav />
            {children}
          </AuthProvider>
        </main>
        <footer className="flex flex-col items-center gap-3 px-4 pb-8">
          <ThemeSwitcher />
          <span className="font-mono text-xs text-muted">
            Rocket v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </footer>
      </body>
    </html>
  );
}
