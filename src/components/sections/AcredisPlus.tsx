'use client';

import { motion } from 'framer-motion';

export function AcredisPlus() {
  return (
    <section className="relative bg-[#0a0e1a] py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* How it works section */}
        <div className="mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              How it works
            </h2>
            <p className="text-gray-400 text-lg">
              Get started in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting lines */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5">
              <div className="relative h-full max-w-5xl mx-auto">
                <div className="absolute left-[16.66%] right-[16.66%] top-0 border-t-2 border-dashed border-gray-700"></div>
              </div>
            </div>

            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#c1ff72]/10 border-2 border-[#c1ff72] flex items-center justify-center mb-6 relative z-10">
                  <span className="text-4xl font-bold text-[#c1ff72]">1</span>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  Create Account
                </h3>
                <p className="text-gray-400">
                  Sign up and complete your profile in minutes
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#c1ff72]/10 border-2 border-[#c1ff72] flex items-center justify-center mb-6 relative z-10">
                  <span className="text-4xl font-bold text-[#c1ff72]">2</span>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  Fund Your Wallet
                </h3>
                <p className="text-gray-400">
                  Add funds securely using your preferred payment method
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#c1ff72]/10 border-2 border-[#c1ff72] flex items-center justify-center mb-6 relative z-10">
                  <span className="text-4xl font-bold text-[#c1ff72]">3</span>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  Start Investing
                </h3>
                <p className="text-gray-400">
                  Choose your investment strategy and watch your portfolio grow
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Benefits section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Benefits content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Acredis Plus
            </h2>
            <p className="text-gray-400 text-lg mb-4">
              Unlock lasting value and new possibilities through our valuable premium partnerships. Bringing you a new stream of financial earnings and growth. The smart way to get more from Acredis.
            </p>
            <p className="text-[#c1ff72] text-xl font-semibold mb-8">
              Acredis plus means more, more, more!
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] shrink-0 mt-1 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-1">Unlimited Financial Planning</h4>
                  <p className="text-gray-400">Unlimited one-on-one collaboration with our experienced Acredis Wealth financial partners</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] shrink-0 mt-1 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-1">More Financial Advice</h4>
                  <p className="text-gray-400">Access to Acredis Wealth program for comprehensive financial guidance</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] shrink-0 mt-1 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-1">More for Investors</h4>
                  <p className="text-gray-400">Top priority access to preferred IPO opportunities</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] shrink-0 mt-1 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-1">Shake Up Your Debt</h4>
                  <p className="text-gray-400">Down with debt. No purchase necessary. Only available to Acredis premium partners.</p>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-8 px-8 py-4 bg-[#c1ff72] text-[#0a0e1a] font-semibold rounded-lg hover:bg-[#c1ff72]/90 transition-colors"
            >
              Get Acredis Plus
            </motion.button>
          </motion.div>

          {/* Right side - Phone mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <div className="relative w-[320px] h-160">
              {/* Phone frame */}
              <div className="absolute inset-0 bg-gray-900 rounded-[3rem] shadow-2xl border-8 border-gray-800 overflow-hidden">
                {/* Screen content */}
                <div className="h-full bg-white flex flex-col">
                  {/* Status bar */}
                  <div className="px-6 py-3 flex justify-between items-center text-xs">
                    <span className="font-semibold">9:41</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-3 border border-black rounded-sm"></div>
                      <div className="w-4 h-3 border border-black rounded-sm"></div>
                      <div className="w-4 h-3 border border-black rounded-sm"></div>
                    </div>
                  </div>

                  {/* Welcome section */}
                  <div className="px-6 py-4">
                    <h3 className="text-xl font-bold text-gray-900">Welcome back,</h3>
                    <p className="text-sm text-gray-500">John Doe</p>
                  </div>

                  {/* Card selection */}
                  <div className="px-6 mb-4">
                    <div className="bg-linear-to-br from-[#c1ff72] to-[#a3e85f] rounded-2xl p-6 text-[#0a0e1a] shadow-lg">
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <p className="text-xs opacity-80 mb-1">Total Balance</p>
                          <p className="text-2xl font-bold">$45,250.00</p>
                        </div>
                        <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs opacity-80">**** **** **** 8456</p>
                        </div>
                        <div className="text-xs font-semibold">PLUS</div>
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="px-6 mb-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        </div>
                        <span className="text-xs text-gray-600">Send</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        </div>
                        <span className="text-xs text-gray-600">Receive</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        </div>
                        <span className="text-xs text-gray-600">Invest</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        </div>
                        <span className="text-xs text-gray-600">More</span>
                      </div>
                    </div>
                  </div>

                  {/* Transactions */}
                  <div className="px-6 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-gray-900">Recent Transactions</h4>
                      <button className="text-xs text-[#c1ff72] font-semibold">See all</button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">Investment Return</p>
                          <p className="text-xs text-gray-500">Today, 2:30 PM</p>
                        </div>
                        <div className="text-sm font-semibold text-green-600 shrink-0">+$125.00</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">Portfolio Rebalance</p>
                          <p className="text-xs text-gray-500">Yesterday, 11:20 AM</p>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 shrink-0">$0.00</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">Dividend Payment</p>
                          <p className="text-xs text-gray-500">Dec 15, 9:15 AM</p>
                        </div>
                        <div className="text-sm font-semibold text-green-600 shrink-0">+$89.50</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom navigation */}
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex justify-around items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 bg-[#c1ff72] rounded"></div>
                        <span className="text-xs text-[#c1ff72] font-semibold">Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        <span className="text-xs text-gray-400">Portfolio</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        <span className="text-xs text-gray-400">Activity</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        <span className="text-xs text-gray-400">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-10"></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
