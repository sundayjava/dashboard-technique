'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function WhyAcredis() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    setIsLoggedIn(!!userData);
  }, []);

  return (
    <section id="why-acredis" className="relative bg-white py-24 overflow-hidden">
      {/* Animated gradient backgrounds */}
      <motion.div
        className="absolute top-20 left-20 w-96 h-96 bg-[#c1ff72] rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-40 right-20 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15"
        animate={{
          x: [0, -80, 0],
          y: [0, 100, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 left-1/3 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-[#c1ff72] rounded-full mix-blend-multiply filter blur-3xl opacity-25"
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Why do members love Acredis?
          </h2>
          
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-gray-700 text-lg">
              <span className="text-gray-900 font-semibold">Smart finance and innovation Acredis plus.</span> Our innovative financial platform puts our members ahead to achieve their goals
            </p>
            <p className="text-gray-700 text-lg">
              <span className="text-gray-900 font-semibold">Ideal financial partnerships and support:</span> Need help? Get in touch with us
            </p>
            <p className="text-gray-700 text-lg">
              <span className="text-gray-900 font-semibold">Member benefits and rewards.</span> Earn Cashback and rewards for crypto deposit
            </p>
          </div>
        </motion.div>

        {/* Subheading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-4xl mx-auto leading-tight">
            Smart financial solutions, seamlessly accessible through the power of digital crypto banking
          </h3>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Accounts Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="group"
          >
            <div className="bg-gray-50 backdrop-blur-lg border border-gray-200 rounded-2xl p-8 h-full hover:bg-white transition-all duration-300 hover:scale-105 hover:border-[#c1ff72]/50 hover:shadow-xl">
              {/* Icon */}
              <div className="w-16 h-16 bg-[#c1ff72]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#c1ff72]/20 transition-colors">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>

              {/* Title */}
              <h4 className="text-2xl font-bold text-gray-900 mb-3">
                Accounts
              </h4>
              
              {/* Subtitle */}
              <p className="text-gray-600 font-semibold mb-4">
                Open an account
              </p>

              {/* Description */}
              <p className="text-gray-600 mb-6">
                Earn interest per annum on your funds and cashback when you deposit with crypto.
              </p>

              {/* Know more link */}
              <button 
                onClick={() => window.location.href = isLoggedIn ? "/banking" : "/create-account"}
                className="inline-flex items-center gap-2 text-gray-900 font-semibold hover:gap-3 transition-all cursor-pointer"
              >
                Know more
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Investments Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="group"
          >
            <div className="bg-gray-50 backdrop-blur-lg border border-gray-200 rounded-2xl p-8 h-full hover:bg-white transition-all duration-300 hover:scale-105 hover:border-[#c1ff72]/50 hover:shadow-xl">
              {/* Icon */}
              <div className="w-16 h-16 bg-[#c1ff72]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#c1ff72]/20 transition-colors">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>

              {/* Title */}
              <h4 className="text-2xl font-bold text-gray-900 mb-3">
                Investments
              </h4>
              
              {/* Subtitle */}
              <p className="text-gray-600 font-semibold mb-4">
                Wealth Management
              </p>

              {/* Description */}
              <p className="text-gray-600 mb-6">
                A digital wealth management experience like no other.
              </p>

              {/* Know more link */}
              <button 
                onClick={() => window.location.href = isLoggedIn ? "/investment" : "/create-account"}
                className="inline-flex items-center gap-2 text-gray-900 font-semibold hover:gap-3 transition-all cursor-pointer"
              >
                Know more
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Payments Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="group"
          >
            <div className="bg-gray-50 backdrop-blur-lg border border-gray-200 rounded-2xl p-8 h-full hover:bg-white transition-all duration-300 hover:scale-105 hover:border-[#c1ff72]/50 hover:shadow-xl">
              {/* Icon */}
              <div className="w-16 h-16 bg-[#c1ff72]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#c1ff72]/20 transition-colors">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Title */}
              <h4 className="text-2xl font-bold text-gray-900 mb-3">
                Payments
              </h4>
              
              {/* Subtitle */}
              <p className="text-gray-600 font-semibold mb-4">
                Pay and get Paid
              </p>

              {/* Description */}
              <p className="text-gray-600 mb-6">
                Enjoy Seamless, lighting-fast payment processing solutions
              </p>

              {/* Know more link */}
              <button 
                onClick={() => window.location.href = isLoggedIn ? "/banking" : "/create-account"}
                className="inline-flex items-center gap-2 text-gray-900 font-semibold hover:gap-3 transition-all cursor-pointer"
              >
                Know more
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
