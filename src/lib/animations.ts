/**
 * Animation Variants Library
 * Reusable animation configurations for Framer Motion
 */

import { Variants } from "framer-motion";

/**
 * Fade In Animations
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { opacity: 0, y: -10 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { opacity: 0, y: 10 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { opacity: 0, x: 10 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { opacity: 0, x: -10 },
};

/**
 * Scale Animations
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" }
  },
  exit: { opacity: 0, scale: 0.95 },
};

export const scaleUp: Variants = {
  hidden: { scale: 0.98 },
  visible: { 
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

/**
 * Slide Animations
 */
export const slideInLeft: Variants = {
  hidden: { x: -30, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { x: -30, opacity: 0 },
};

export const slideInRight: Variants = {
  hidden: { x: 30, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { x: 30, opacity: 0 },
};

export const slideInUp: Variants = {
  hidden: { y: 100, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: { y: 100, opacity: 0 },
};

export const slideInDown: Variants = {
  hidden: { y: -100, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: { y: -100, opacity: 0 },
};

/**
 * Rotate Animations
 */
export const rotateIn: Variants = {
  hidden: { opacity: 0, rotate: -180 },
  visible: { 
    opacity: 1, 
    rotate: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
  exit: { opacity: 0, rotate: 180 },
};

/**
 * Stagger Container
 * For animating children with delays
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: { opacity: 0, y: -10 },
};

/**
 * Hover & Tap Effects
 */
export const hoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.15 } },
  whileTap: { scale: 0.98 },
};

export const hoverLift = {
  whileHover: { y: -2, transition: { duration: 0.15 } },
  whileTap: { y: 0 },
};

export const hoverGlow = {
  whileHover: { 
    boxShadow: "0 0 20px rgba(193, 255, 114, 0.4)",
    transition: { duration: 0.2 } 
  },
};

/**
 * Page Transition
 */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.4,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.3 }
  },
};

/**
 * Modal/Overlay Animations
 */
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.15 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.1 }
  },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.96,
    y: 10,
    transition: { duration: 0.15 }
  },
};

/**
 * Loading Animations
 */
export const pulseAnimation = {
  scale: [1, 1.02, 1],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

export const spinAnimation = {
  rotate: 360,
  transition: {
    duration: 0.8,
    repeat: Infinity,
    ease: "linear",
  },
};

/**
 * Custom Easing Curves
 */
export const easings = {
  easeInOut: [0.43, 0.13, 0.23, 0.96],
  easeOut: [0.16, 1, 0.3, 1],
  easeIn: [0.87, 0, 0.13, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
};

/**
 * Transition Presets
 */
export const transitions = {
  fast: { duration: 0.15, ease: "easeOut" },
  medium: { duration: 0.25, ease: "easeOut" },
  slow: { duration: 0.4, ease: "easeOut" },
  spring: { type: "spring", stiffness: 400, damping: 25 },
  springBounce: { type: "spring", stiffness: 600, damping: 20 },
};
