'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function SmartCard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    setIsLoggedIn(!!userData);
  }, []);

  return (
    <section className="relative bg-[#0a0e1a] py-24 overflow-hidden">
      {/* Animated gradient backgrounds */}
      <motion.div
        className="absolute top-20 right-20 w-96 h-96 bg-[#c1ff72] rounded-full mix-blend-multiply filter blur-3xl opacity-10"
        animate={{
          x: [0, -80, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 left-20 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-8"
        animate={{
          x: [0, -50, 0],
          y: [0, 80, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Elevate your way of spending
            </h2>
            
            <p className="text-xl sm:text-2xl text-[#c1ff72] font-semibold mb-8">
              Go virtual with your Acredis crypto smart card
            </p>

            {/* Features */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white text-lg font-semibold">Spend without limitation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#c1ff72] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-[#0a0e1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white text-lg font-semibold">Unlimited 12% cash back rewards</span>
              </div>
            </div>

            <p className="text-gray-500 text-sm mb-8 italic">
              *Cards are available on paid plan only
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <motion.button
                onClick={() => window.location.href = isLoggedIn ? "/banking" : "/create-account"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-[#c1ff72] text-[#0a0e1a] cursor-pointer font-semibold rounded-lg hover:bg-[#c1ff72]/90 transition-colors"
              >
                Request Card
              </motion.button>
              <motion.button
                onClick={() => window.location.href = "/products"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 border-2 border-white/20 text-white cursor-pointer font-semibold rounded-lg hover:border-[#c1ff72] hover:text-[#c1ff72] transition-colors"
              >
                Learn More
              </motion.button>
            </div>
          </motion.div>

          {/* Right side - Card Mockups */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-125 h-100">
              {/* Back Card */}
              <motion.div
                initial={{ opacity: 0, y: 50, rotate: 0 }}
                whileInView={{ opacity: 1, y: 0, rotate: -8 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                className="absolute top-12 right-8 w-[320px] h-50 rounded-2xl shadow-2xl"
                style={{
                  boxShadow: '0 0 40px rgba(193, 255, 114, 0.2), 0 20px 60px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Animated gradient border */}
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-75"
                  style={{
                    background: 'linear-gradient(45deg, #c1ff72, #22d3ee, #c1ff72)',
                    backgroundSize: '200% 200%',
                    padding: '2px',
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <div className="h-full w-full rounded-2xl bg-linear-to-br from-gray-800 to-gray-900">
                    <div className="relative h-full p-6 flex flex-col justify-between">
                      {/* Chip */}
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-10 rounded-md bg-linear-to-br from-yellow-400 to-yellow-600 opacity-80"></div>
                        <div className="text-white/60 text-sm font-semibold">VISA</div>
                      </div>

                      {/* Card Number */}
                      <div className="space-y-4">
                        <div className="text-white/80 text-lg font-mono tracking-wider">
                          **** **** **** 8456
                        </div>
                        
                        {/* Name and Date */}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-white/60 text-xs mb-1">Card Holder</p>
                            <p className="text-white text-sm font-semibold">AcredisPay</p>
                          </div>
                          <div>
                            <p className="text-white/60 text-xs mb-1">Expires</p>
                            <p className="text-white text-sm font-semibold">12/28</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Front Card */}
              <motion.div
                initial={{ opacity: 0, y: 50, rotate: 0 }}
                whileInView={{ opacity: 1, y: 0, rotate: 5 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
                className="absolute top-0 left-0 w-[320px] h-50 rounded-2xl shadow-2xl"
                style={{
                  boxShadow: '0 0 60px rgba(34, 211, 238, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Animated gradient border */}
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-90"
                  style={{
                    background: 'linear-gradient(90deg, #22d3ee, #c1ff72, #a78bfa, #22d3ee)',
                    backgroundSize: '300% 300%',
                    padding: '2px',
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <div className="h-full w-full rounded-2xl bg-linear-to-br from-[#1a2332] via-[#0f1419] to-[#0a0e1a]">
                    <div className="relative h-full p-6 flex flex-col justify-between overflow-hidden">
                      {/* Glow effect */}
                      <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400/20 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#c1ff72]/10 rounded-full blur-3xl"></div>

                      {/* Logo and Chip */}
                      <div className="flex justify-between items-start relative z-10">
                        <div className="w-12 h-10 rounded-md bg-linear-to-br from-yellow-400 to-yellow-600"></div>
                        <div className="text-cyan-400 text-sm font-bold">VISA</div>
                      </div>

                      {/* Card Number */}
                      <div className="space-y-4 relative z-10">
                        <div className="text-white text-lg font-mono tracking-wider">
                          **** **** **** 9234
                        </div>
                        
                        {/* Name and Date */}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-cyan-400/80 text-xs mb-1">Card Holder</p>
                            <p className="text-white text-sm font-semibold">AcredisPay</p>
                          </div>
                          <div>
                            <p className="text-cyan-400/80 text-xs mb-1">Expires</p>
                            <p className="text-white text-sm font-semibold">12/29</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Decorative elements */}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#c1ff72]/20 rounded-full blur-3xl"></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
