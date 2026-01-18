"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift } from "@/lib/animations";

export interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: "default" | "bordered" | "elevated";
  hoverEffect?: boolean;
  children: React.ReactNode;
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, variant = "default", hoverEffect = true, children, ...props }, ref) => {
    const variants = {
      default: "bg-background",
      bordered: "bg-background border border-foreground/10",
      elevated: "bg-background shadow-lg",
    };

    const hoverProps = hoverEffect ? {
      whileHover: { y: -2, boxShadow: "0 8px 20px -8px rgba(0, 0, 0, 0.2)" },
      transition: { duration: 0.15 }
    } : {};

    return (
      <motion.div
        ref={ref}
        className={cn("rounded-lg p-6", variants[variant], className)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        {...hoverProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";

const AnimatedCardHeader = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 pb-4", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      {...props}
    />
  )
);

AnimatedCardHeader.displayName = "AnimatedCardHeader";

const AnimatedCardTitle = React.forwardRef<HTMLHeadingElement, HTMLMotionProps<"h3">>(
  ({ className, ...props }, ref) => (
    <motion.h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      {...props}
    />
  )
);

AnimatedCardTitle.displayName = "AnimatedCardTitle";

const AnimatedCardDescription = React.forwardRef<HTMLParagraphElement, HTMLMotionProps<"p">>(
  ({ className, ...props }, ref) => (
    <motion.p
      ref={ref}
      className={cn("text-sm text-foreground/60", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      {...props}
    />
  )
);

AnimatedCardDescription.displayName = "AnimatedCardDescription";

const AnimatedCardContent = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, ...props }, ref) => (
    <motion.div 
      ref={ref} 
      className={cn("pt-0", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      {...props} 
    />
  )
);

AnimatedCardContent.displayName = "AnimatedCardContent";

const AnimatedCardFooter = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn("flex items-center pt-4", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      {...props}
    />
  )
);

AnimatedCardFooter.displayName = "AnimatedCardFooter";

export { 
  AnimatedCard, 
  AnimatedCardHeader, 
  AnimatedCardFooter, 
  AnimatedCardTitle, 
  AnimatedCardDescription, 
  AnimatedCardContent 
};
