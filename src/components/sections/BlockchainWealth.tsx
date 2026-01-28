"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function BlockchainWealth() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const features = [
    {
      number: "01",
      title: "Beyond Traditional Returns: The New Wealth Paradigm",
      description:
        "The blockchain is more than an asset class; it's a new financial layer being built in real-time. We provide the bridge and the tools to move beyond speculation into strategic, generational wealth creation.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      number: "02",
      title: "Our Approach: Sophisticated Access, Simplified",
      description:
        "Our integrated platform transforms the fragmented crypto landscape into a cohesive portfolio. Our technology provides real-time insights, institutional-grade security, and automated strategies, invest with conviction and clarity.",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      number: "03",
      title: "Why This Matters for You: Growth, Empowerment, Legacy",
      description:
        "This is accelerated investing for a reason. We enable you to be part of projects that redefine industries, while our banking infrastructure ensures your wealth is secure, manageable, and poised for long-term transformation.",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      number: "04",
      title: "Your Partner in the Digital Frontier",
      description:
        "We merge the innovative potential. Enjoy seamless integration between your crypto investments and traditional finances—instant fiat gateways, yield-bearing accounts, personalized lending against your portfolio, and a single, comprehensive view of your entire net worth.",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleStartBuilding = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  };

  return (
    <section className="relative py-24 overflow-hidden bg-linear-to-br from-gray-900 via-black to-gray-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#c1ff72] rounded-full blur-[128px]"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[128px]"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Building Investment Wealth in the{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#c1ff72] to-green-400">
              Blockchain Ecosystem
            </span>
          </h2>
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xl text-gray-300 leading-relaxed">
              We build investment wealth in the blockchain ecosystem because it
              is fundamentally more rewarding.
            </p>
            <p className="text-lg text-gray-400 leading-relaxed">
              This is about investing today in tomorrow's future—accelerated,
              transformative, and aligned with the evolution of value itself.
            </p>
            <p className="text-lg text-gray-400 leading-relaxed">
              We are not just observers of this autonomous marvel; we are active
              participants and enablers of your financial frontier.
            </p>
          </div>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div
                className={`relative bg-gray-800/50 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 ${
                  expandedIndex === index
                    ? "border-[#c1ff72]"
                    : "border-gray-700"
                }`}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Title */}
                    <h3 className="text-lg md:text-xl font-bold text-white">
                      {feature.title}
                    </h3>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <motion.div
                    animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="shrink-0"
                  >
                    <svg
                      className="w-6 h-6 text-[#c1ff72]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </motion.div>
                </button>

                {/* Accordion Content */}
                <AnimatePresence initial={false}>
                  {expandedIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2">
                        <div className="">
                          <p className="text-gray-300 leading-relaxed text-base">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStartBuilding}
              className="px-8 py-4 bg-[#c1ff72] text-black font-bold rounded-full hover:opacity-90 transition-opacity"
            >
              Explore Investment Options
            </button>
            <button
              onClick={handleStartBuilding}
              className="px-8 py-4 bg-transparent border-2 border-[#c1ff72] text-[#c1ff72] font-bold rounded-full hover:bg-[#c1ff72] hover:text-black transition-all"
            >
              Start Building Wealth
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
