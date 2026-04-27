import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Orbitron } from "next/font/google";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CustomForge - Gaming PC & Accessories",
  description: "Premium gaming PCs, components, and accessories",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(orbitron.variable, "antialiased dark")}>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>
          <div className="min-h-dvh flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
              <Navbar />
              <EmailVerificationBanner />
              <main className="flex-1">{children}</main>
              <Footer />
            </Suspense>
          </div>
          <Toaster />
          <Sonner />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
