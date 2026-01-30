"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MobileDrawer } from "./MobileDrawer";
import { useUIStore } from "@/store";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  submenu?: { label: string; href: string; icon?: string }[];
  gridLayout?: boolean; // For multi-column dropdown
}

const navItems: NavItem[] = [
  { label: "Acredis plus", href: "/#how-it-works" },
  { label: "Banking", href: "/banking" },
  { 
    label: "Services", 
    href: "/services",
    gridLayout: true,
    submenu: [
      { label: "Personal Banking", href: "banking" },
      { label: "Business Banking", href: "banking" },
      { label: "Investment Services", href: "support" },
      { label: "Digital Banking", href: "banking" },
      { label: "Cross-border Banking", href: "banking" },
      { label: "Support & Resources", href: "support" },
      { label: "Wealth Management", href: "support" },
      { label: "Credit Services", href: "support" },
      { label: "Insurance Services", href: "support" },
      { label: "Foreign Exchange", href: "support" },
      { label: "Trade Finance", href: "support" },
      { label: "Advisory Services", href: "support" },
      { label: "Investment Loans", href: "support" },
      { label: "B2B Banking", href: "banking" },
      { label: "Financial Insights", href: "support" },
      { label: "Crypto", href: "support" },
      { label: "Acredis Invest", href: "support" },
    ]
  },
  { label: "About", href: "/#why-acredis" },
  { label: "Contact", href: "/contact" },
  { label: "Investment Strategy", href: "/investment-strategy" },
];

export function Header1() {
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const { setSelectedService } = useUIStore();
  const router = useRouter();

  React.useEffect(() => {
    const handleScroll = () => {
      // Only enable scroll animation on desktop (lg breakpoint and above)
      if (window.innerWidth >= 1024) {
        setIsScrolled(window.scrollY > 50);
      } else {
        setIsScrolled(false);
      }
    };

    handleScroll(); // Check on mount
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    setIsLoggedIn(!!userData);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Background with gradient glow effect */}
        <div className="absolute inset-0 bg-linear-to-r from-[#0a0e1a]/95 via-[#0a0e1a] to-[#0a0e1a]/95 -z-10" />
        
        {/* Radial gradient glow overlay for shine effect */}
        <div className="absolute inset-0 bg-linear-to-r from-[#0a0e1a]/70 via-[#c1ff72]/30 to-[#0a0e1a]/70 -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-24 bg-[#c1ff72]/20 blur-3xl rounded-full -z-10" />
        
        <nav className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between h-16 lg:hidden">
            {/* Mobile Logo */}
            <div className="flex shrink-0">
              <a href="/" className="cursor-pointer flex items-center gap-3">
                <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={150} height={40} className="h-12 w-auto" priority />
                <span className="text-xl font-bold text-white whitespace-nowrap">
                  <span className="text-[#c1ff72]">A</span>credis Finance
                </span>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-2 text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                aria-label="Open menu"
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
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <motion.div 
            className="hidden lg:flex items-center h-16"
            animate={{
              justifyContent: isScrolled ? "center" : "space-between"
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {/* Logo - outside pill when not scrolled */}
            <motion.div 
              className="shrink-0 absolute left-0"
              animate={{
                opacity: isScrolled ? 0 : 1,
                x: isScrolled ? -20 : 0
              }}
              transition={{ duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
            >
              <a href="/" className="cursor-pointer flex items-center gap-3">
                <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={150} height={40} className="h-12 w-auto" priority />
                <span className="text-xl font-bold text-white whitespace-nowrap">
                  <span className="text-[#c1ff72]">A</span>credis Finance
                </span>
              </a>
            </motion.div>

            {/* Desktop Navigation - Centered with dark pill background */}
            <motion.div 
              className="flex items-center justify-center"
              animate={{
                flex: isScrolled ? "0" : "1"
              }}
              transition={{ duration: 0.4 }}
            >
              <motion.div 
                className="flex items-center bg-white/10 backdrop-blur-md rounded-full border border-white/10"
                animate={{
                  paddingLeft: isScrolled ? 32 : 8,
                  paddingRight: isScrolled ? 32 : 8,
                  paddingTop: isScrolled ? 10 : 6,
                  paddingBottom: isScrolled ? 10 : 6,
                  gap: isScrolled ? 16 : 8
                }}
                transition={{ duration: 0.4 }}
              >
                {/* Logo - moves inside pill on scroll */}
                <motion.div 
                  className="shrink-0"
                  animate={{
                    opacity: isScrolled ? 1 : 0,
                    width: isScrolled ? "auto" : 0,
                    marginRight: isScrolled ? 8 : 0
                  }}
                  transition={{ duration: 0.4 }}
                  style={{ overflow: "hidden" }}
                  whileHover={{ scale: isScrolled ? 1.02 : 1 }}
                >
                  <a href="/" className="text-base font-bold text-white cursor-pointer whitespace-nowrap">
                    <span className="text-primary">A</span>credis Finance
                  </a>
                </motion.div>

                {/* Navigation Items */}
                {navItems.map((item) => (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => item.submenu && setActiveDropdown(item.label)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <a
                      href={item.label === "Banking" ? (isLoggedIn ? "/dashboard" : "/login") : item.href}
                      className={cn(
                        "px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-all cursor-pointer rounded-full whitespace-nowrap",
                        activeDropdown === item.label && "text-white bg-white/10"
                      )}
                    >
                      {item.label}
                      {item.submenu && (
                        <svg
                          className="inline-block ml-1 w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </a>

                    {/* Dropdown Menu */}
                    {item.submenu && (
                      <AnimatePresence>
                        {activeDropdown === item.label && (
                          <motion.div
                            className={cn(
                              "absolute top-full mt-2 bg-white border-2 text-black border-white/20 rounded-sm p-4 shadow-2xl overflow-hidden z-9999",
                              item.gridLayout ? "left-1/2 -translate-x-1/2 w-200" : "left-0 w-56"
                            )}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {item.gridLayout ? (
                              <div className="grid grid-cols-4 gap-0">
                                {item.submenu.map((subItem) => (
                                  <div
                                    key={subItem.label}
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      setSelectedService(subItem.label);
                                      // Navigate to home page and scroll to services section
                                      router.push("/#services");
                                      // Small delay to ensure navigation completes before scrolling
                                      setTimeout(() => {
                                        const element = document.getElementById("services");
                                        if (element) {
                                          element.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }
                                      }, 100);
                                    }}
                                    className="block px-4 py-3 text-sm font-medium text-black/80 hover:text-black hover:bg-[#a6d64a]/30 transition-colors cursor-pointer border-b border-r border-white/10 last:border-b-0"
                                  >
                                    {subItem.label}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              item.submenu.map((subItem) => (
                                <a
                                  key={subItem.label}
                                  href={subItem.href}
                                  className="block px-4 py-3 text-sm font-medium text-black/80 hover:text-black hover:bg-[#a6d64a]/20 transition-colors cursor-pointer border-b border-white/10 last:border-b-0"
                                >
                                  {subItem.label}
                                </a>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                ))}

                {/* Auth Buttons - move inside pill on scroll */}
                <motion.div 
                  className="flex items-center"
                  animate={{
                    opacity: isScrolled ? 1 : 0,
                    width: isScrolled ? "auto" : 0,
                    marginLeft: isScrolled ? 16 : 0,
                    gap: isScrolled ? 8 : 0
                  }}
                  transition={{ duration: 0.4 }}
                  style={{ overflow: "hidden" }}
                >
                  {isLoggedIn ? (
                    <motion.button
                      onClick={() => window.location.href = "/dashboard"}
                      className="px-6 py-2 text-sm font-bold text-[#0a0e1a] bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-[#c1ff72]/30 whitespace-nowrap"
                      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(193, 255, 114, 0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                    >
                      Dashboard
                    </motion.button>
                  ) : (
                    <>
                      <motion.button
                        onClick={() => window.location.href = "/login"}
                        className="px-5 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-full hover:bg-white/15 transition-all cursor-pointer whitespace-nowrap"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                      >
                        Login
                      </motion.button>
                      <motion.button
                        onClick={() => window.location.href = "/create-account"}
                        className="px-5 py-2 text-sm ml-3 font-bold text-[#0a0e1a] bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-[#c1ff72]/30 whitespace-nowrap"
                        whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(193, 255, 114, 0.5)" }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                      >
                        Signup
                      </motion.button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Desktop Auth Buttons - outside pill when not scrolled */}
            <motion.div 
              className="flex items-center space-x-3 absolute right-0"
              animate={{
                opacity: isScrolled ? 0 : 1,
                x: isScrolled ? 20 : 0
              }}
              transition={{ duration: 0.4 }}
            >
              {isLoggedIn ? (
                <motion.button
                  onClick={() => window.location.href = "/dashboard"}
                  className="px-6 py-2.5 text-sm font-bold text-[#0a0e1a] bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-[#c1ff72]/30"
                  whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(193, 255, 114, 0.5)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  Dashboard
                </motion.button>
              ) : (
                <>
                  <motion.button
                    onClick={() => window.location.href = "/login"}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-full hover:bg-white/15 transition-all cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    Login
                  </motion.button>
                  <motion.button
                    onClick={() => window.location.href = "/create-account"}
                    className="px-6 py-2.5 text-sm font-bold text-[#0a0e1a] bg-[#c1ff72] rounded-full hover:bg-[#c1ff72]/90 transition-all cursor-pointer shadow-lg shadow-[#c1ff72]/30"
                    whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(193, 255, 114, 0.5)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    Signup
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        </nav>
      </motion.header>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        navItems={navItems}
      />

      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-16" />
    </>
  );
}
