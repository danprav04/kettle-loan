// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import ThemeProvider from "@/components/ThemeProvider";
import SimplifiedLayoutProvider from "@/components/SimplifiedLayoutProvider";
import SyncProvider from "@/components/SyncProvider";
import UserProvider from "@/components/UserProvider"; // Import UserProvider
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loan Calculator",
  description: "A simple loan calculator app with offline support.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loan Calculator",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Explicit PWA-related meta tags for robustness */}
        <meta name="application-name" content="LoanCalc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LoanCalc" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <IntlProvider>
            <UserProvider>
              <SimplifiedLayoutProvider>
                <SyncProvider>
                  <main>{children}</main>
                </SyncProvider>
              </SimplifiedLayoutProvider>
            </UserProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}