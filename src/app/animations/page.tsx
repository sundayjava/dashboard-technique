"use client";

import { useState } from "react";
import {
  AnimatedButton,
  AnimatedCard,
  AnimatedCardHeader,
  AnimatedCardTitle,
  AnimatedCardContent,
  AnimatedContainer,
  AnimatedItem,
  FadeIn,
  ScaleIn,
  SlideIn,
  HoverScale,
  HoverLift,
  Pulse,
  AnimatedModal,
  PageTransition,
  AnimatedList,
  AnimatedListItem,
  RevealOnScroll,
  AnimatedCounter,
  TypingAnimation,
} from "@/components/animated";
import { useDisclosure } from "@/hooks";
import { motion } from "framer-motion";

export default function AnimationsDemo() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <FadeIn className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Animation Showcase
            </h1>
            <p className="text-xl text-foreground/70">
              Framer Motion powered animations - Smooth, performant, and beautiful
            </p>
          </FadeIn>

          {/* Stats Section */}
          <AnimatedContainer stagger className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <AnimatedItem>
              <AnimatedCard variant="bordered" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle className="text-4xl text-primary">
                    <AnimatedCounter to={50} duration={2} />+
                  </AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">Animation Variants</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </AnimatedItem>

            <AnimatedItem>
              <AnimatedCard variant="bordered" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle className="text-4xl text-primary">
                    <AnimatedCounter to={10} duration={2} />+
                  </AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">Custom Hooks</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </AnimatedItem>

            <AnimatedItem>
              <AnimatedCard variant="bordered" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle className="text-4xl text-primary">
                    <AnimatedCounter to={100} duration={2} />%
                  </AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">Modular Design</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </AnimatedItem>
          </AnimatedContainer>

          {/* Typing Effect */}
          <FadeIn className="mb-12">
            <AnimatedCard variant="elevated">
              <AnimatedCardHeader>
                <AnimatedCardTitle>Typing Effect</AnimatedCardTitle>
              </AnimatedCardHeader>
              <AnimatedCardContent>
                <div className="text-2xl font-semibold text-primary">
                  <TypingAnimation text="Welcome to Acredis Finance! 🎉" speed={100} />
                </div>
              </AnimatedCardContent>
            </AnimatedCard>
          </FadeIn>

          {/* Button Variants */}
          <RevealOnScroll direction="up">
            <AnimatedCard variant="bordered" className="mb-12">
              <AnimatedCardHeader>
                <AnimatedCardTitle>Animated Buttons</AnimatedCardTitle>
              </AnimatedCardHeader>
              <AnimatedCardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <AnimatedButton variant="default">Default</AnimatedButton>
                  <AnimatedButton variant="primary">Primary</AnimatedButton>
                  <AnimatedButton variant="outline">Outline</AnimatedButton>
                  <AnimatedButton variant="ghost">Ghost</AnimatedButton>
                  <AnimatedButton variant="destructive">Destructive</AnimatedButton>
                  <AnimatedButton isLoading>Loading</AnimatedButton>
                </div>
                <div className="flex flex-wrap gap-3">
                  <AnimatedButton size="sm" variant="primary">Small</AnimatedButton>
                  <AnimatedButton size="md" variant="primary">Medium</AnimatedButton>
                  <AnimatedButton size="lg" variant="primary">Large</AnimatedButton>
                </div>
              </AnimatedCardContent>
            </AnimatedCard>
          </RevealOnScroll>

          {/* Modal Demo */}
          <RevealOnScroll direction="up">
            <AnimatedCard variant="bordered" className="mb-12">
              <AnimatedCardHeader>
                <AnimatedCardTitle>Modal Animation</AnimatedCardTitle>
              </AnimatedCardHeader>
              <AnimatedCardContent>
                <AnimatedButton variant="primary" onClick={onOpen}>
                  Open Animated Modal
                </AnimatedButton>
              </AnimatedCardContent>
            </AnimatedCard>
          </RevealOnScroll>

          {/* Slide In Variants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <SlideIn direction="left">
              <AnimatedCard variant="bordered">
                <AnimatedCardHeader>
                  <AnimatedCardTitle>Slide from Left</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">
                    This card slides in from the left side with a smooth animation.
                  </p>
                </AnimatedCardContent>
              </AnimatedCard>
            </SlideIn>

            <SlideIn direction="right">
              <AnimatedCard variant="bordered">
                <AnimatedCardHeader>
                  <AnimatedCardTitle>Slide from Right</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">
                    This card slides in from the right side with a smooth animation.
                  </p>
                </AnimatedCardContent>
              </AnimatedCard>
            </SlideIn>
          </div>

          {/* Hover Effects */}
          <RevealOnScroll direction="up">
            <AnimatedCard variant="bordered" className="mb-12">
              <AnimatedCardHeader>
                <AnimatedCardTitle>Hover Effects</AnimatedCardTitle>
              </AnimatedCardHeader>
              <AnimatedCardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <HoverScale className="p-6 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer">
                    <h3 className="font-semibold mb-2">Hover Scale</h3>
                    <p className="text-sm text-foreground/70">Scales up on hover</p>
                  </HoverScale>

                  <HoverLift className="p-6 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer">
                    <h3 className="font-semibold mb-2">Hover Lift</h3>
                    <p className="text-sm text-foreground/70">Lifts up on hover</p>
                  </HoverLift>

                  <Pulse className="p-6 bg-primary/10 rounded-lg border border-primary/20">
                    <h3 className="font-semibold mb-2">Pulse</h3>
                    <p className="text-sm text-foreground/70">Continuous pulse effect</p>
                  </Pulse>
                </div>
              </AnimatedCardContent>
            </AnimatedCard>
          </RevealOnScroll>

          {/* Staggered List */}
          <RevealOnScroll direction="up">
            <AnimatedCard variant="bordered">
              <AnimatedCardHeader>
                <AnimatedCardTitle>Staggered List Animation</AnimatedCardTitle>
              </AnimatedCardHeader>
              <AnimatedCardContent>
                <AnimatedList className="space-y-3">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <AnimatedListItem
                      key={item}
                      className="p-4 bg-foreground/5 rounded-lg border border-foreground/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">List Item {item}</span>
                        <span className="text-primary">✨</span>
                      </div>
                    </AnimatedListItem>
                  ))}
                </AnimatedList>
              </AnimatedCardContent>
            </AnimatedCard>
          </RevealOnScroll>

          {/* Scale In Demo */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScaleIn delay={0}>
              <AnimatedCard variant="elevated" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle>Scale In</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">Scales in with fade</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </ScaleIn>

            <ScaleIn delay={0.2}>
              <AnimatedCard variant="elevated" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle>Delayed</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">With 0.2s delay</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </ScaleIn>

            <ScaleIn delay={0.4}>
              <AnimatedCard variant="elevated" hoverEffect>
                <AnimatedCardHeader>
                  <AnimatedCardTitle>More Delay</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <p className="text-foreground/70">With 0.4s delay</p>
                </AnimatedCardContent>
              </AnimatedCard>
            </ScaleIn>
          </div>

          {/* Scroll Animation Info */}
          <div className="mt-16">
            <RevealOnScroll direction="up">
              <AnimatedCard variant="bordered">
                <AnimatedCardHeader>
                  <AnimatedCardTitle>💡 Animation Features</AnimatedCardTitle>
                </AnimatedCardHeader>
                <AnimatedCardContent>
                  <ul className="space-y-2 text-foreground/70">
                    <li>✅ 50+ pre-built animation variants</li>
                    <li>✅ Scroll-triggered animations</li>
                    <li>✅ Hover and tap effects</li>
                    <li>✅ Stagger animations for lists</li>
                    <li>✅ Modal and page transitions</li>
                    <li>✅ Custom hooks for animation control</li>
                    <li>✅ TypeScript support throughout</li>
                    <li>✅ Fully modular and reusable</li>
                  </ul>
                </AnimatedCardContent>
              </AnimatedCard>
            </RevealOnScroll>
          </div>
        </div>

        {/* Animated Modal */}
        <AnimatedModal isOpen={isOpen} onClose={onClose} title="Animated Modal">
          <div className="space-y-4">
            <p className="text-foreground/70">
              This modal appears with a smooth fade and scale animation. The backdrop has a
              beautiful blur effect.
            </p>
            <div className="flex gap-3">
              <AnimatedButton variant="primary" onClick={onClose}>
                Awesome!
              </AnimatedButton>
              <AnimatedButton variant="outline" onClick={onClose}>
                Close
              </AnimatedButton>
            </div>
          </div>
        </AnimatedModal>
      </div>
    </PageTransition>
  );
}
