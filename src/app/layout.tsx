import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campaign Finance Risk Copilot",
  description:
    "Mock adtech revenue leakage, margin risk, and billing discrepancy workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream text-ink">{children}</body>
    </html>
  );
}
