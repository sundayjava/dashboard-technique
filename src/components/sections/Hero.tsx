"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";

export function Hero() {
  const [portfolioValue, setPortfolioValue] = useState(168.02);

  useEffect(() => {
    const interval = setInterval(() => {
      setPortfolioValue((prev) => {
        const increment = (Math.random() * 0.5 - 0.1); // Random increment between -0.1 and 0.4
        return parseFloat((prev + increment).toFixed(2));
      });
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center bg-white">
      
      {/* Central flowing gradient - shapeless, organic, and animated */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute w-350 h-250 rounded-[40%_60%_70%_30%/60%_30%_70%_40%] bg-[#c1ff72] opacity-8 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-275 h-275 rounded-[60%_40%_30%_70%/40%_60%_50%_50%] bg-[#ffffff] opacity-6 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -120, 0],
            x: [40, -40, 40],
            y: [-24, 40, -24],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-225 h-300 rounded-[30%_70%_50%_50%/50%_50%_30%_70%] bg-purple-500 opacity-6 blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            rotate: [0, 60, 0],
            x: [-48, 30, -48],
            y: [40, -50, 40],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-200 h-225 rounded-[70%_30%_60%_40%/30%_70%_40%_60%] bg-[#ffffff] opacity-3 blur-3xl"
          animate={{
            scale: [1, 1.25, 1],
            rotate: [0, -90, 0],
            x: [-20, 60, -20],
            y: [-32, 20, -32],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-250 h-237.5 rounded-[50%_50%_40%_60%/55%_45%_55%_45%] bg-[#c1ff72] opacity-1 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 0],
            x: [20, -70, 20],
            y: [10, 60, 10],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[15%] left-[10%] w-1 h-1 bg-primary/40 rounded-full animate-pulse" />
        <div className="absolute top-[25%] right-[15%] w-1 h-1 bg-primary/30 rounded-full animate-pulse delay-100" />
        <div className="absolute top-[35%] left-[25%] w-1 h-1 bg-primary/20 rounded-full animate-pulse delay-200" />
        <div className="absolute top-[45%] right-[30%] w-1 h-1 bg-primary/40 rounded-full animate-pulse delay-300" />
        <div className="absolute top-[20%] left-[70%] w-1 h-1 bg-primary/25 rounded-full animate-pulse delay-150" />
        <div className="absolute top-[55%] left-[15%] w-1 h-1 bg-primary/35 rounded-full animate-pulse delay-250" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 max-w-7xl">
        <div className="flex flex-col items-center">
          {/* Content Section - Top */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mb-8 sm:mb-12 lg:mb-16"
          >
            {/* Small badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0a0e1a]/5 backdrop-blur-sm border border-gray-200 rounded-full mb-6 sm:mb-8"
            >
              <div className="w-2 h-2 bg-[#c1ff72] rounded-full" />
              <span className="text-sm font-medium text-gray-700">Portfolio</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight px-4"
            >
              Acredis Blockchain Banking
            </motion.h1>

            {/* Subheading */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-700 mb-4 sm:mb-6 px-4"
            >
              Unlock the next generation digital finance experience
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 sm:mb-10 max-w-3xl mx-auto px-4"
            >
              Discover a revolutionary financial platform that harnesses the power of blockchain technology to redefine the future of finance.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              <motion.button
                onClick={() => window.location.href = "/create-account"}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-semibold text-black bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-[#c1ff72]/30"
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -12px rgba(122, 163, 255, 0.5)" }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                Get Started Today
              </motion.button>
              <motion.button
                onClick={() => window.location.href = "/contact"}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium text-gray-900 bg-gray-100 border border-gray-300 rounded-full hover:bg-gray-200 transition-all cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                Request a Demo
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Dashboard Image - Bottom */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="w-full max-w-7xl px-4"
          >
            <div className="relative overflow-hidden">
              {/* Dashboard mockup with realistic interface */}
              <div className="aspect-video bg-white relative border border-gray-200">
                {/* Top bar */}
                <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-6">
                    <div className="text-gray-900 font-semibold text-xs sm:text-sm">v6</div>
                    <div className="hidden sm:flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                      <span>Overview</span>
                      <span className="text-gray-900">Home</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden sm:flex items-center gap-2 text-gray-500 text-xs sm:text-sm">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="hidden md:inline">Search</span>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                </div>

                {/* Main content area */}
                <div className="absolute top-10 sm:top-14 left-0 right-0 bottom-0 grid grid-cols-12 gap-2 sm:gap-4 p-2 sm:p-6">
                  {/* Left sidebar */}
                  <div className="hidden lg:flex col-span-1 flex-col gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-linear-to-br from-[#c1ff72] to-[#c1ff72]" />
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                      <div className="text-base sm:text-lg">📊</div>
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                      <div className="text-base sm:text-lg">💼</div>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                      <div className="w-5 h-5">📈</div>
                    </div>
                  </div>

                  {/* Center - Portfolio chart */}
                  <div className="col-span-12 lg:col-span-7 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-6">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h3 className="text-gray-900 font-semibold text-sm sm:text-base">Total Portfolio</h3>
                      <button className="px-2 sm:px-4 py-1.5 sm:py-2 bg-white rounded-lg text-gray-600 text-xs sm:text-sm flex items-center gap-1 sm:gap-2 border border-gray-200">
                        + <span className="hidden sm:inline">Add Portfolio</span>
                      </button>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 sm:gap-4 mb-2 text-xs sm:text-sm text-gray-500 overflow-x-auto">
                      <span>All</span>
                      <span>Crypto</span>
                      <span>Gold</span>
                      <span>Silver</span>
                      <span>Stocks</span>
                      <span>Funds</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-8">{portfolioValue.toFixed(2)}</div>
                    
                    {/* Chart area */}
                    <div className="relative h-32 sm:h-48">
                      <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                        <path
                          d="M 0 180 Q 50 170 100 160 T 200 140 T 300 120 T 400 100 T 500 80"
                          fill="none"
                          stroke="#c1ff72"
                          strokeWidth="2"
                          opacity="0.8"
                        />
                        <path
                          d="M 0 180 Q 50 170 100 160 T 200 140 T 300 120 T 400 100 T 500 80 L 500 200 L 0 200 Z"
                          fill="url(#gradient)"
                          opacity="0.2"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#c1ff72" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#c1ff72" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="hidden sm:flex absolute bottom-0 left-0 right-0 justify-between text-xs text-gray-400 px-2">
                        <span>Jan</span>
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                      </div>
                    </div>
                  </div>

                  {/* Right - Allocation */}
                  <div className="hidden lg:block col-span-4 bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h3 className="text-gray-900 font-semibold text-sm sm:text-base">Allocation</h3>
                      <span className="text-gray-500 text-xs sm:text-sm cursor-pointer">See More</span>
                    </div>
                    
                    {/* Donut chart */}
                    <div className="relative w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-4 sm:mb-6">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Donut segments */}
                        <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeDasharray="55 165" />
                        <circle cx="50" cy="50" r="35" fill="none" stroke="#c1ff72" strokeWidth="12" strokeDasharray="110 110" strokeDashoffset="-55" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-xs text-gray-500">Total Value</div>
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{portfolioValue.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="text-center text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">Limited Offer on Premium</div>
                    <div className="text-center text-xs text-gray-400">Grab it now</div>
                  </div>
                </div>
              </div>
              
              {/* White gradient blur at bottom edge */}
              <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-20 bg-linear-to-t from-white via-white/95 to-transparent pointer-events-none z-10" />
            </div>
          </motion.div>

          {/* Trusted Platforms - Infinite Scroll */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="w-full max-w-7xl mt-8"
          >
            <div className="relative overflow-hidden py-4">
              {/* Gradient overlays for smooth fade */}
              <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 bg-linear-to-r from-white to-transparent z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 bg-linear-to-l from-white to-transparent z-10" />
              
              {/* Scrolling container */}
              <motion.div
                className="flex gap-12 sm:gap-16 items-center"
                animate={{
                  x: [0, -1600],
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 30,
                    ease: "linear",
                  },
                }}
              >
                {/* Platform logos - duplicated for seamless loop */}
                {[...Array(2)].map((_, idx) => (
                  <div key={idx} className="flex gap-12 sm:gap-16 items-center shrink-0">
                    {/* Coinbase */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Coinbase</div>
                    
                    {/* Binance */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Binance</div>
                    
                    {/* Stripe */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Stripe</div>
                    
                    {/* PayPal */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">PayPal</div>
                    
                    {/* Visa */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">VISA</div>
                    
                    {/* Mastercard */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Mastercard</div>
                    
                    {/* Ethereum */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Ethereum</div>
                    
                    {/* Polygon */}
                    <div className="text-3xl sm:text-4xl font-bold text-gray-500">Polygon</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
