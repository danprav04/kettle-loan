// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import IntlProvider from "@/components/IntlProvider"; // Check your path alias if needed
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
    <html lang="en">
      <body className={inter.className}>
        <IntlProvider>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}