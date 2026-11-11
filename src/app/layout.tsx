import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContinuityX — Project Knowledge Continuity Platform",
  description:
    "AI-powered project knowledge continuity and proof-carrying handover platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
      </body>
    </html>
  );
}
