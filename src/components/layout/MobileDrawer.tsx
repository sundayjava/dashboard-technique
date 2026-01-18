"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  submenu?: { label: string; href: string }[];
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
}

export function MobileDrawer({ isOpen, onClose, navItems }: MobileDrawerProps) {
  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 w-full sm:w-80 bg-linear-to-b from-[#0a0e1a] via-[#0d1221] to-[#0a0e1a] shadow-2xl z-50 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                <span className="text-primary">A</span>credis Finance
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
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

            {/* Navigation Items */}
            <div className="p-4 space-y-2">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {item.submenu ? (
                    // Item with submenu
                    <div>
                      <button
                        onClick={() => setExpandedItem(expandedItem === item.label ? null : item.label)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-base font-medium rounded-md transition-colors cursor-pointer",
                          expandedItem === item.label
                            ? "bg-primary/10 text-white"
                            : "text-white/80 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <span>{item.label}</span>
                        <motion.svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          animate={{ rotate: expandedItem === item.label ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </motion.svg>
                      </button>

                      {/* Submenu */}
                      <AnimatePresence>
                        {expandedItem === item.label && (
                          <motion.div
                            className="ml-4 mt-1 space-y-1"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {item.submenu.map((subItem) => (
                              <a
                                key={subItem.label}
                                href={subItem.href}
                                className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-primary/5 rounded-md transition-colors cursor-pointer"
                                onClick={onClose}
                              >
                                {subItem.label}
                              </a>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    // Regular item
                    <a
                      href={item.href}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                      onClick={onClose}
                    >
                      {item.label}
                    </a>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Auth Buttons */}
            <div className="p-4 pt-6 space-y-3 border-t border-white/10">
              <motion.button
                onClick={() => {
                  onClose();
                  window.location.href = "/login";
                }}
                className="w-full px-6 py-2.5 text-sm font-medium text-white border border-white/20 rounded-full hover:bg-white/5 transition-all cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Login
              </motion.button>
              <motion.button
                onClick={() => {
                  onClose();
                  window.location.href = "/create-account";
                }}
                className="w-full px-6 py-2.5 text-sm font-medium text-[#0a0e1a] bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-primary/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Signup
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
