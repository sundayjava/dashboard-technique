"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useUIStore } from "@/store";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { SupportModal } from "@/components/modals";

interface ServiceContent {
  title: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  ctaType: "login" | "support";
  image: string;
}

const servicesContent: Record<string, ServiceContent> = {
  "Personal Banking": {
    title: "Personal Banking Solutions",
    description: "Experience modern banking designed for your lifestyle. Manage your finances with ease through our comprehensive personal banking services.",
    features: [
      "Zero-fee checking and savings accounts",
      "Instant money transfers worldwide",
      "24/7 mobile banking access",
      "Personalized financial insights"
    ],
    ctaText: "Open Your Account",
    ctaLink: "/login",
    ctaType: "login",
    image: "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?q=80&w=2070&auto=format&fit=crop"
  },
  "Business Banking": {
    title: "Business Banking Excellence",
    description: "Empower your business with our tailored banking solutions. From startups to enterprises, we've got you covered.",
    features: [
      "Business accounts with low fees",
      "Corporate credit cards",
      "Payroll management services",
      "Business loans and credit lines"
    ],
    ctaText: "Start Banking for Business",
    ctaLink: "/login",
    ctaType: "login",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop"
  },
  "Investment Services": {
    title: "Investment Services",
    description: "Grow your wealth with our comprehensive investment services. Professional guidance for your financial future.",
    features: [
      "Diverse investment portfolios",
      "Expert financial advisors",
      "Tax-optimized strategies",
      "Regular performance reviews"
    ],
    ctaText: "Learn More",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop"
  },
  "Digital Banking": {
    title: "Digital-First Banking",
    description: "Bank anywhere, anytime with our cutting-edge digital platform. Experience the future of banking today.",
    features: [
      "100% online account opening",
      "Instant virtual cards",
      "Biometric security",
      "Real-time notifications"
    ],
    ctaText: "Go Digital Now",
    ctaLink: "/login",
    ctaType: "login",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
  },
  "Cross-border Banking": {
    title: "Cross-Border Banking Made Easy",
    description: "Send and receive money globally with competitive rates. Your gateway to international banking.",
    features: [
      "Multi-currency accounts",
      "Low foreign exchange fees",
      "SWIFT and SEPA transfers",
      "International trade support"
    ],
    ctaText: "Start Global Banking",
    ctaLink: "/login",
    ctaType: "login",
    image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=2070&auto=format&fit=crop"
  },
  "Support & Resources": {
    title: "Support & Resources",
    description: "Get the help you need when you need it. Access our comprehensive support resources and expert assistance.",
    features: [
      "24/7 customer support",
      "Extensive knowledge base",
      "Live chat assistance",
      "Video tutorials and guides"
    ],
    ctaText: "Get Support",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=2072&auto=format&fit=crop"
  },
  "Wealth Management": {
    title: "Wealth Management",
    description: "Preserve and grow your wealth with our dedicated wealth management services. Personalized strategies for high-net-worth individuals.",
    features: [
      "Personalized wealth strategies",
      "Estate planning assistance",
      "Tax optimization",
      "Legacy planning"
    ],
    ctaText: "Explore Wealth Management",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1554224311-beee1080a6a7?q=80&w=2070&auto=format&fit=crop"
  },
  "Credit Services": {
    title: "Credit Services",
    description: "Access credit when you need it most. Flexible credit solutions tailored to your needs.",
    features: [
      "Personal and business loans",
      "Credit cards with rewards",
      "Line of credit options",
      "Competitive interest rates"
    ],
    ctaText: "Apply for Credit",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=2070&auto=format&fit=crop"
  },
  "Insurance Services": {
    title: "Insurance Services",
    description: "Protect what matters most with our comprehensive insurance solutions. Coverage for every aspect of your life.",
    features: [
      "Life and health insurance",
      "Property and casualty coverage",
      "Business insurance solutions",
      "Personalized coverage plans"
    ],
    ctaText: "Get Insured",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2070&auto=format&fit=crop"
  },
  "Foreign Exchange": {
    title: "Foreign Exchange Services",
    description: "Get the best exchange rates for your international transactions. Fast, secure, and cost-effective currency exchange.",
    features: [
      "Competitive exchange rates",
      "150+ currencies supported",
      "Real-time rate updates",
      "Low transfer fees"
    ],
    ctaText: "Exchange Currency",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop"
  },
  "Trade Finance": {
    title: "Trade Finance Solutions",
    description: "Facilitate international trade with our comprehensive trade finance services. Supporting importers and exporters worldwide.",
    features: [
      "Letters of credit",
      "Trade guarantees",
      "Export and import financing",
      "Documentary collections"
    ],
    ctaText: "Learn About Trade Finance",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=2070&auto=format&fit=crop"
  },
  "Advisory Services": {
    title: "Advisory Services",
    description: "Expert financial advice tailored to your unique situation. Make confident financial decisions with our guidance.",
    features: [
      "Financial planning consultations",
      "Investment strategy advice",
      "Risk assessment and management",
      "Retirement planning"
    ],
    ctaText: "Book a Consultation",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop"
  },
  "B2B Banking": {
    title: "B2B Banking Solutions",
    description: "Streamline your business-to-business transactions with our specialized B2B banking platform.",
    features: [
      "Bulk payment processing",
      "Automated invoicing",
      "Supply chain financing",
      "API integration for seamless operations"
    ],
    ctaText: "Explore B2B Solutions",
    ctaLink: "/login",
    ctaType: "login",
    image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=2051&auto=format&fit=crop"
  },
  "Investment Loans": {
    title: "Investment Loans",
    description: "Fuel your investment dreams with our flexible loan solutions. Get the capital you need to grow your portfolio.",
    features: [
      "Competitive interest rates",
      "Flexible repayment terms",
      "Quick approval process",
      "Investment advisory support"
    ],
    ctaText: "Apply for a Loan",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "/photo-1579621970563-ebec7560ff3e.avif"
  },
  "Financial Insights": {
    title: "Financial Insights & Analytics",
    description: "Make informed decisions with our advanced financial analytics and insights platform. Track, analyze, and optimize your wealth.",
    features: [
      "Real-time portfolio tracking",
      "AI-powered market predictions",
      "Personalized investment recommendations",
      "Comprehensive financial reports"
    ],
    ctaText: "Get Insights",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "/photo-1551288049-bebda4e38f71.avif"
  },
  "Crypto": {
    title: "Cryptocurrency Services",
    description: "Step into the future of finance with our secure cryptocurrency platform. Buy, sell, and manage digital assets with confidence.",
    features: [
      "Trade 100+ cryptocurrencies",
      "Secure cold storage wallets",
      "Real-time crypto insights",
      "Low transaction fees"
    ],
    ctaText: "Start Trading Crypto",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "/photo-1621416894569-0f39ed31d247.avif"
  },
  "Acredis Invest": {
    title: "Acredis Invest",
    description: "Build your wealth with our professional investment management services. Let our experts help you achieve your financial goals.",
    features: [
      "Diversified investment portfolios",
      "Expert fund management",
      "Risk-adjusted returns",
      "Transparent fee structure"
    ],
    ctaText: "Start Investing",
    ctaLink: "/support-system",
    ctaType: "support",
    image: "/photo-1611974789855-9c2a0a7236a3.avif"
  }
};

export function ServicesShowcase() {
  const { selectedService } = useUIStore();
  const router = useRouter();
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    setIsLoggedIn(!!userData);
  }, []);

  if (!selectedService || !servicesContent[selectedService]) {
    return null;
  }

  const handleCTAClick = () => {
    const service = servicesContent[selectedService];
    if (service.ctaType === "support") {
      setIsSupportModalOpen(true);
    } else {
      // For login type services, check if user is logged in
      router.push(isLoggedIn ? "/dashboard" : "/login");
    }
  };

  const service = servicesContent[selectedService];

  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedService}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="grid md:grid-cols-2 gap-12 items-center"
          >
            {/* Left Side - Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
                {service.title}
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                {service.description}
              </p>
              
              {/* Features List */}
              <ul className="space-y-4 mb-8">
                {service.features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <svg
                      className="w-6 h-6 text-primary shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.button
                onClick={handleCTAClick}
                className="px-8 py-4 bg-linear-to-r from-primary to-[#a6d64a] text-gray-900 font-bold rounded-full hover:shadow-xl hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {service.ctaText}
                <svg
                  className="inline-block ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </motion.button>
            </motion.div>

            {/* Right Side - Image */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative h-125 rounded-2xl overflow-hidden shadow-2xl"
            >
              <Image
                src={service.image}
                alt={service.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        initialTopic={selectedService}
      />
    </section>
  );
}
