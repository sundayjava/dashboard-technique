import type { Metadata } from "next";
import { Hero, AcredisPlus, CryptoRewards, WhyAcredis, BlockchainWealth, SmartCard, InvestmentPlans, FAQ, ServicesShowcase } from "@/components/sections";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Acredis Finance | Modern Banking, Crypto & Investment Platform",
  description:
    "Acredis Finance provides modern banking, crypto rewards, smart cards, and curated investment plans to help you grow wealth securely.",
  keywords: [
    "Acredis Finance",
    "digital banking",
    "crypto rewards",
    "investment plans",
    "smart card",
    "wealth management",
    "fintech platform",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Acredis Finance | Modern Banking, Crypto & Investment Platform",
    description:
      "Modern banking, crypto rewards, smart cards, and investment plans built for long-term growth.",
    type: "website",
    url: "https://acredisfinance.com",
    siteName: "Acredis Finance",
    images: [
      {
        url: "/photo-1551288049-bebda4e38f71.avif",
        width: 1200,
        height: 630,
        alt: "Acredis Finance dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Acredis Finance | Modern Banking, Crypto & Investment Platform",
    description:
      "Modern banking, crypto rewards, smart cards, and investment plans built for long-term growth.",
    images: ["/photo-1551288049-bebda4e38f71.avif"],
  },
  alternates: {
    canonical: "https://acredisfinance.com",
  },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Acredis Finance",
    url: "https://acredisfinance.com",
    logo: "https://acredisfinance.com/logo/WG_Gbg_Fin-No-bg.png",
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <AcredisPlus />
      <ServicesShowcase />
      <CryptoRewards />
      <WhyAcredis />
      <BlockchainWealth />
      <SmartCard />
      <InvestmentPlans />
      <FAQ />
      <Footer />
    </div>
  );
}
