'use client';

import { motion } from 'framer-motion';

export function CryptoRewards() {
  return (
    <section className="relative bg-white pt-24 md:pb-24 pb-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Trading Card Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex justify-center lg:justify-start"
          >
            <div className="relative w-full max-w-85">
              {/* Main Card */}
              <div className="bg-linear-to-br from-[#1a2332] to-[#0f1419] rounded-3xl p-8 shadow-2xl">
                {/* Tabs */}
                <div className="flex gap-8 mb-8">
                  <button className="text-[#c1ff72] font-semibold text-sm pb-2 border-b-2 border-[#c1ff72]">
                    Buy
                  </button>
                  <button className="text-gray-500 font-semibold text-sm pb-2">
                    Sell
                  </button>
                </div>

                {/* Stop Limit Section */}
                <div className="mb-6">
                  <p className="text-gray-400 text-xs mb-2">Stop Limit</p>
                  
                  {/* Input Fields */}
                  <div className="space-y-3">
                    {/* USDT Input */}
                    <div className="bg-[#0a0e1a] rounded-xl p-4 border border-gray-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">You Pay</p>
                          <p className="text-white text-lg font-semibold">16406.23568255</p>
                        </div>
                        <div className="bg-gray-800 px-3 py-1.5 rounded-lg">
                          <span className="text-white text-sm font-semibold">USDT</span>
                        </div>
                      </div>
                    </div>

                    {/* BTC Input */}
                    <div className="bg-[#0a0e1a] rounded-xl p-4 border border-gray-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">You Get</p>
                          <p className="text-white text-lg font-semibold">0.423525688</p>
                        </div>
                        <div className="bg-gray-800 px-3 py-1.5 rounded-lg">
                          <span className="text-white text-sm font-semibold">BTC</span>
                        </div>
                      </div>
                    </div>

                    {/* Price Input */}
                    <div className="bg-[#0a0e1a] rounded-xl p-4 border border-gray-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">Price</p>
                          <p className="text-white text-lg font-semibold">7765.61320083</p>
                        </div>
                        <div className="bg-gray-800 px-3 py-1.5 rounded-lg">
                          <span className="text-white text-sm font-semibold">USDT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buy Button */}
                <button className="w-full bg-[#c1ff72] hover:bg-[#c1ff72] text-black cursor-pointer font-semibold py-4 rounded-xl transition-colors">
                  Buy BTC
                </button>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-8 -left-8 w-32 h-32 bg-[#c1ff72]/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#c1ff72]/10 rounded-full blur-3xl"></div>
            </div>
          </motion.div>

          {/* Right side - Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              We suggest you,{' '}
              <br className="hidden sm:block" />
              the <span className="text-[#c1ff72]">best deals</span>
            </h2>
            
            <div className="space-y-3 mb-8">
              <p className="text-gray-700 text-lg">
                Earn rewards every time you fund your account with crypto. Our digital bank rewards you for using digital assets—turning everyday deposits into added value while enjoying seamless, secure, and instant funding.
              </p>
              <p className="text-gray-700 text-lg">
                It's our way of rewarding smart, forward-thinking banking.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#c1ff72] text-black cursor-pointer font-semibold rounded-xl hover:bg-[#c1ff72] transition-colors"
            >
              See how
              <svg 
                className="w-5 h-5" 
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

            {/* Decorative Arrow */}
            <div className="mt-8 opacity-20">
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
                <path 
                  d="M10 30 Q 40 10, 70 30 T 110 30" 
                  stroke="#c1ff72" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                  fill="none"
                />
                <circle cx="110" cy="30" r="4" fill="#c1ff72" />
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
