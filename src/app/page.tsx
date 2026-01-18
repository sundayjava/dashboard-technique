"use client";

import { Hero, AcredisPlus, CryptoRewards, WhyAcredis, SmartCard, InvestmentPlans, FAQ } from "@/components/sections";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <AcredisPlus />
      <CryptoRewards />
      <WhyAcredis />
      <SmartCard />
      <InvestmentPlans />
      <FAQ />
      <Footer />
    </div>
  );
}
