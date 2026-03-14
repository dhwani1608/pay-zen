import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayZen | Shared Money, Drawn Clearly",
  description:
    "A handwritten-style shared expense workspace for groups, wallets, settlements, notes, and insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f2e1be" />
      </head>
      <body className="app-body">{children}</body>
    </html>
  );
}
