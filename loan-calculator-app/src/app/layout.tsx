// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeProvider from "@/components/ThemeProvider"; // Import ThemeProvider
import ThemeSwitcher from "@/components/ThemeSwitcher";   // Import ThemeSwitcher
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loan Calculator",
  description: "A simple loan calculator app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body className={inter.className}>
        <ThemeProvider>
          <IntlProvider>
            <ThemeSwitcher />
            <LanguageSwitcher />
            <main>{children}</main>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}