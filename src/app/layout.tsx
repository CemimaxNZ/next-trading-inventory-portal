import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Trading Inventory Portal",
  description: "Internal inventory management portal for Next Trading.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

