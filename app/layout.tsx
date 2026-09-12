import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSessionProvider } from "../components/auth/AppSessionProvider";
import { AuthenticatedShell } from "../components/layout/AuthenticatedShell";
import { TenantProvider } from "../components/tenant/TenantProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { ThemeScript } from "../components/ThemeScript";
import { loadAuthenticatedAppBootstrap } from "../Lib/auth/loadAuthenticatedBootstrap";
import { getRequestPathname } from "../Lib/http/requestPathname";
import { isPublicRoutePathname } from "../Lib/publicRoutes";
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
  title: "Catering · PSCS One",
  description: "Multi-company catering operations, quotes, orders, invoices and finance",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = await getRequestPathname()
  const publicRoute = isPublicRoutePathname(pathname)
  const bootstrap = publicRoute ? null : await loadAuthenticatedAppBootstrap()

  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>

      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <AppSessionProvider initialSession={bootstrap?.session ?? null}>
            <TenantProvider initialTenantContext={bootstrap?.tenant ?? null}>
              <AuthenticatedShell>{children}</AuthenticatedShell>
            </TenantProvider>
          </AppSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
