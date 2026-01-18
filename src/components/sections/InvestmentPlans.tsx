'use client';

import { motion } from 'framer-motion';

export function InvestmentPlans() {
  return (
    <section className="relative bg-white py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Grow your money with up to 55.68% APY (Variable)
          </h2>
          <p className="text-xl text-gray-700 max-w-4xl mx-auto">
            Interest earned daily. Scale your balance across your Acredis portfolio or account above 10,000 and earn competitive returns up to 55.6% APY (variable). APY (Annual Percentage Yield) is the effective annual rate of return on an account, factoring in the effect of compounding interest over a year. It represents what you'd earn in one year.
          </p>
        </motion.div>

        {/* Investment Cards */}
        <div className="md:grid md:grid-cols-3 md:gap-8 mb-12 flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {/* Card 1 - Conservative Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-2xl p-8 hover:scale-105 transition-transform duration-300 min-w-[320px] sm:min-w-87.5 md:min-w-0 snap-center"
          >
            {/* Icon */}
            <div className="w-16 h-16 bg-linear-to-br from-[#c1ff72] to-[#a3e85f] rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-white mb-4">
              Conservative Growth
            </h3>

            {/* Description */}
            <p className="text-gray-400 mb-6">
              Low-risk strategy designed for steady, reliable returns with capital preservation as the priority.
            </p>

            {/* Features */}
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Diversified across stable assets</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Minimal volatility exposure</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Daily interest compounding</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>15-25% APY (variable)</span>
              </li>
            </ul>
          </motion.div>

          {/* Card 2 - Balanced Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-2xl p-8 hover:scale-105 transition-transform duration-300 min-w-[320px] sm:min-w-87.5 md:min-w-0 snap-center"
          >
            {/* Icon */}
            <div className="w-16 h-16 bg-linear-to-br from-[#c1ff72] to-[#a3e85f] rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-white mb-4">
              Balanced Portfolio
            </h3>

            {/* Description */}
            <p className="text-gray-400 mb-6">
              Optimal mix of growth and stability, engineered for consistent performance across market conditions.
            </p>

            {/* Features */}
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Blend of conservative and growth assets</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Moderate risk with higher potential returns</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Auto-rebalancing for optimization</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>30-45% APY (variable)</span>
              </li>
            </ul>
          </motion.div>

          {/* Card 3 - Aggressive Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-2xl p-8 hover:scale-105 transition-transform duration-300 min-w-[320px] sm:min-w-87.5 md:min-w-0 snap-center"
          >
            {/* Icon */}
            <div className="w-16 h-16 bg-linear-to-br from-[#c1ff72] to-[#a3e85f] rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-white mb-4">
              High-Yield Growth
            </h3>

            {/* Description */}
            <p className="text-gray-400 mb-6">
              Maximum return potential for visionaries ready to embrace calculated risks for exceptional gains.
            </p>

            {/* Features */}
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Focused on high-growth opportunities</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Dynamic portfolio management</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Advanced risk mitigation strategies</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-[#c1ff72] mt-1">•</span>
                <span>Up to 55.68% APY (variable)</span>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Explore Our Plans
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
