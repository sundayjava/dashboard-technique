"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components";
import { Header1 } from "@/components/layout";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { setupAxiosInterceptors } from "@/lib/axios-config";
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

  // Initialize axios interceptors on mount
  useEffect(() => {
    setupAxiosInterceptors();
  }, []);

  // Hide header in dashboard routes, admin routes, investment dashboard route, PIN verification, and password reset pages
  const hideHeader =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/admin") ||
    pathname === "/investment" ||
    pathname?.startsWith("/investment/") ||
    pathname?.startsWith("/verify-pin") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/reset-password");

  // Show live chat only on vital public pages
  const showLiveChat =
    pathname === "/contact" ||
    pathname === "/dashboard/support/message" ||
    pathname === "/news" ||
    pathname === "/acredis-plus" ||
    pathname === "/create-account" ||
    pathname === "/dashboard/support/faq" ||
    pathname === "/login";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider />
        <NetworkStatusIndicator showOverlay />
        {!hideHeader && <Header1 />}
        {children}

        {/* Tawk.to Live Chat - Only on vital public pages */}
        {showLiveChat && (
          <Script
            id="tawk-to-chat"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
                (function(){
                var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
                s1.async=true;
                s1.src='https://embed.tawk.to/66fb539ae5982d6c7bb6d9a4/1i92rt5if';
                s1.charset='UTF-8';
                s1.setAttribute('crossorigin','*');
                s0.parentNode.insertBefore(s1,s0);
                })();
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
