import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCG Co-op EV Taxi Guarantee",
  description: "Advanced blue-white-green neon prototype for EV Taxi credit guarantee."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
