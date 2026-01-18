"use client";

import { useEffect, useRef } from "react";
import { useInView, useAnimation, UseInViewOptions } from "framer-motion";

/**
 * Hook for animating elements when they enter the viewport
 * @param once - Whether to animate only once
 * @param margin - Margin around the viewport (e.g., "-100px")
 * @returns ref and controls for the animation
 */
export function useScrollAnimation(options?: UseInViewOptions) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px", ...options });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return { ref, controls, isInView };
}

/**
 * Hook for sequential animations
 */
export function useSequentialAnimation(delay: number = 0) {
  const controls = useAnimation();

  useEffect(() => {
    const timer = setTimeout(() => {
      controls.start("visible");
    }, delay);

    return () => clearTimeout(timer);
  }, [controls, delay]);

  return controls;
}

/**
 * Hook for hover animation state
 */
export function useHoverAnimation() {
  const controls = useAnimation();

  const handleHoverStart = () => {
    controls.start("hover");
  };

  const handleHoverEnd = () => {
    controls.start("visible");
  };

  return { controls, handleHoverStart, handleHoverEnd };
}
