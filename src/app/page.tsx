"use client";

import { Hero, AcredisPlus, CryptoRewards, WhyAcredis, BlockchainWealth, SmartCard, InvestmentPlans, FAQ, ServicesShowcase } from "@/components/sections";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
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
