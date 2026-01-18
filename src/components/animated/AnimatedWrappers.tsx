"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations";
import { useScrollAnimation } from "@/hooks/useAnimation";

/**
 * Animated Container
 * Wrapper that animates children on scroll
 */
interface AnimatedContainerProps extends HTMLMotionProps<"div"> {
  stagger?: boolean;
  delay?: number;
}

export function AnimatedContainer({ 
  children, 
  stagger = false, 
  delay = 0,
  ...props 
}: AnimatedContainerProps) {
  const { ref, controls } = useScrollAnimation();

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={stagger ? staggerContainer : fadeInUp}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Item
 * Use inside AnimatedContainer with stagger
 */
export function AnimatedItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}

/**
 * Fade In Component
 * Simple fade in on mount or scroll
 */
interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
  triggerOnScroll?: boolean;
}

export function FadeIn({ 
  children, 
  delay = 0, 
  triggerOnScroll = false,
  ...props 
}: FadeInProps) {
  const { ref, controls } = useScrollAnimation();

  if (triggerOnScroll) {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={controls}
        variants={fadeInUp}
        transition={{ delay }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scale In Component
 * Scales up on mount with fade
 */
interface ScaleInProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

export function ScaleIn({ children, delay = 0, ...props }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide In Component
 * Slides in from specified direction
 */
interface SlideInProps extends HTMLMotionProps<"div"> {
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
}

export function SlideIn({ 
  children, 
  direction = "up", 
  delay = 0,
  ...props 
}: SlideInProps) {
  const variants = {
    left: { x: -30, opacity: 0 },
    right: { x: 30, opacity: 0 },
    up: { y: 30, opacity: 0 },
    down: { y: -30, opacity: 0 },
  };

  return (
    <motion.div
      initial={variants[direction]}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover Scale Component
 * Scales on hover
 */
export function HoverScale({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover Lift Component
 * Lifts on hover
 */
export function HoverLift({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ y: 0 }}
      transition={{ duration: 0.15 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Pulse Component
 * Continuous pulse animation
 */
export function Pulse({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Spinner Component
 * Continuous rotation animation
 */
export function Spinner({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
