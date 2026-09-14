import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prestige Motion - Exclusive Car Collection",
  description: "Redefining mobility for the modern elite.",
};

import AuthNotifier from "@/components/AuthNotifier";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <noscript>
          <style dangerouslySetInnerHTML={{
            __html: `
              .animate-hero-kicker,
              .animate-hero-title,
              .animate-hero-desc,
              .animate-hero-cta,
              .animate-hero-badges,
              .animate-page-header,
              .animate-page-desc,
              .animate-ambient-glow {
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
              }
            `
          }} />
        </noscript>
        {children}
        <AuthNotifier />
      </body>
    </html>
  );
}
