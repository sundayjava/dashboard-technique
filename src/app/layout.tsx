'use client';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components";
import { Header1 } from "@/components/layout";
import { usePathname } from "next/navigation";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Hide header in dashboard routes, PIN verification, and password reset pages
  const hideHeader = pathname?.startsWith('/dashboard') || 
                     pathname?.startsWith('/admin/dashboard') ||
                     pathname?.startsWith('/verify-pin') ||
                     pathname?.startsWith('/forgot-password') ||
                     pathname?.startsWith('/reset-password');

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <ToastProvider />
        {!hideHeader && <Header1 />}
        {children}
      </body>
    </html>
  );
}
