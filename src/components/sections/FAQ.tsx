'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const faqs = [
  {
    question: "How can I track my investment portfolio using Acredis?",
    answer: "Acredis provides an intuitive portfolio tracker where you can manually add your assets or sync directly with your brokerage account. Once added, you can monitor real-time performance, diversification, and overall growth."
  },
  {
    question: "Is Acredis free to use?",
    answer: "Acredis offers both free and premium plans. The free plan includes basic portfolio tracking and investment features. Premium plans unlock advanced analytics, priority support, lower fees, and exclusive investment opportunities."
  },
  {
    question: "How do I add my assets to the Acredis portfolio tracker?",
    answer: "You can add assets manually by entering the ticker symbol and quantity, or connect your brokerage account for automatic synchronization. The platform supports stocks, bonds, crypto, and other investment vehicles."
  },
  {
    question: "What features does Acredis offer for beginner investors?",
    answer: "Acredis offers educational resources, guided investment plans, risk assessment tools, and automated portfolio recommendations. Our platform is designed to help beginners start investing confidently with clear insights and support."
  },
  {
    question: "Can I connect my brokerage account to Acredis?",
    answer: "Yes, Acredis supports integration with major brokerage accounts for seamless portfolio tracking. Your data is encrypted and secured using bank-level security protocols to ensure complete confidentiality."
  },
  {
    question: "Can I see insights or analysis from other investors in the community?",
    answer: "Acredis Plus members gain access to our investor community features, including anonymized portfolio insights, strategy discussions, and expert analysis. This helps you learn from successful investors while maintaining privacy."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative bg-white py-24 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            If you have any further inquiries or doubts about our services, please don't hesitate to reach out. Rest assured, all communications are handled with the utmost confidentiality.
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 sm:px-8 py-6 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg sm:text-xl font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                <div className="shrink-0">
                  {openIndex === index ? (
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                </div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-6 sm:px-8 pb-6 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
