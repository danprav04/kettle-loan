// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher"; // Import the new component
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
        <IntlProvider>
          <LanguageSwitcher />
          <main>{children}</main>
        </IntlProvider>
      </body>
    </html>
  );
}