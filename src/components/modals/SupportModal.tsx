"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COUNTRY_CODES } from "@/constants/countries";
import axios from "axios";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
}

const supportTopics = [
  "Investment Services",
  "Support & Resources",
  "Wealth Management",
  "Credit Services",
  "Insurance Services",
  "Foreign Exchange",
  "Trade Finance",
  "Advisory Services",
  "Investment Loans",
  "Financial Insights",
  "Crypto",
  "Acredis Invest",
];

export function SupportModal({ isOpen, onClose, initialTopic }: SupportModalProps) {
  const [formData, setFormData] = useState({
    accountNumber: "",
    email: "",
    countryCode: "+1",
    phoneNumber: "",
    topic: initialTopic || "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      await axios.post('/api/support-requests', formData);

      setSubmitStatus({
        type: "success",
        message: "Your request has been submitted successfully! Our team will contact you soon.",
      });

      // Reset form
      setFormData({
        accountNumber: "",
        email: "",
        countryCode: "+1",
        phoneNumber: "",
        topic: "",
        message: "",
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSubmitStatus({ type: null, message: "" });
      }, 2000);
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Failed to submit your request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-9998"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-9999 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-linear-to-r from-primary to-[#a6d64a] px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Support Request</h2>
                    <p className="text-sm text-gray-800">We're here to help you</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Account Number */}
                  <div>
                    <label
                      htmlFor="accountNumber"
                      className="block text-sm font-semibold text-gray-700 mb-1"
                    >
                      Account Number
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Enter your account number"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-gray-700 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  {/* Phone Number with Country Code */}
                  <div>
                    <label
                      htmlFor="phoneNumber"
                      className="block text-sm font-semibold text-gray-700 mb-1"
                    >
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="countryCode"
                        value={formData.countryCode}
                        onChange={handleChange}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white"
                        style={{ width: "140px" }}
                      >
                        {COUNTRY_CODES.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        id="phoneNumber"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        required
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  {/* Topic Selection */}
                  <div>
                    <label
                      htmlFor="topic"
                      className="block text-sm font-semibold text-gray-700 mb-1"
                    >
                      Select Topic
                    </label>
                    <select
                      id="topic"
                      name="topic"
                      value={formData.topic}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white"
                    >
                      <option value="">Choose a topic...</option>
                      {supportTopics.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-semibold text-gray-700 mb-1"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                      placeholder="Please describe your inquiry in detail..."
                    />
                  </div>

                  {/* Submit Status */}
                  {submitStatus.type && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg text-sm ${
                        submitStatus.type === "success"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {submitStatus.type === "success" ? (
                          <svg
                            className="w-5 h-5 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        <p className="font-medium">{submitStatus.message}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-linear-to-r from-primary to-[#a6d64a] text-gray-900 font-bold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        "Submit Request"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
