// src/app/layout.tsx

// This file must remain simple and only pass down its children.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}