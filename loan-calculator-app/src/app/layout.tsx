// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import ThemeProvider from "@/components/ThemeProvider";
import SimplifiedLayoutProvider from "@/components/SimplifiedLayoutProvider";
import SyncProvider from "@/components/SyncProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loan Calculator",
  description: "A simple loan calculator app",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loan Calculator",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
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