// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import ThemeProvider from "@/components/ThemeProvider";
import SimplifiedLayoutProvider from "@/components/SimplifiedLayoutProvider";
import SyncProvider from "@/components/SyncProvider";
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
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <IntlProvider>
            <SimplifiedLayoutProvider>
              <SyncProvider>
                <main>{children}</main>
              </SyncProvider>
            </SimplifiedLayoutProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}