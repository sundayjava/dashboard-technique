# Framer Motion Animations Guide

## 🎨 Animation System Overview

Your application now includes a comprehensive Framer Motion animation system with 50+ pre-built variants, custom hooks, and modular components.

---

## 📁 Animation Files Structure

```
src/
├── lib/
│   └── animations.ts          # Animation variants library
│
├── hooks/
│   └── useAnimation.ts        # Custom animation hooks
│
└── components/
    └── animated/
        ├── AnimatedWrappers.tsx     # Container, Item, FadeIn, etc.
        ├── AnimatedButton.tsx       # Animated button component
        ├── AnimatedCard.tsx         # Animated card component
        ├── AnimatedModal.tsx        # Animated modal component
        ├── AnimatedEffects.tsx      # Special effects & utilities
        └── index.ts                 # Export all animated components
```

---

## 🚀 Quick Start

### Basic Usage

```tsx
import { AnimatedButton, FadeIn, AnimatedCard } from '@/components/animated';

function MyComponent() {
  return (
    <FadeIn>
      <AnimatedCard>
        <h2>Hello World</h2>
        <AnimatedButton variant="primary">Click Me</AnimatedButton>
      </AnimatedCard>
    </FadeIn>
  );
}
```

---

## 📦 Available Components

### 1. **AnimatedButton**
Button with hover and tap animations.

```tsx
<AnimatedButton variant="primary" size="lg">
  Click Me
</AnimatedButton>
```

**Props:**
- `variant`: "default" | "primary" | "outline" | "ghost" | "destructive"
- `size`: "sm" | "md" | "lg"
- `isLoading`: boolean

---

### 2. **AnimatedCard**
Card with hover lift effect and fade-in animation.

```tsx
<AnimatedCard variant="bordered" hoverEffect>
  <AnimatedCardHeader>
    <AnimatedCardTitle>Title</AnimatedCardTitle>
    <AnimatedCardDescription>Description</AnimatedCardDescription>
  </AnimatedCardHeader>
  <AnimatedCardContent>
    Content here
  </AnimatedCardContent>
</AnimatedCard>
```

**Props:**
- `variant`: "default" | "bordered" | "elevated"
- `hoverEffect`: boolean (default: true)

---

### 3. **AnimatedModal**
Modal with smooth overlay and content animations.

```tsx
import { useDisclosure } from '@/hooks';

function MyComponent() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  return (
    <>
      <button onClick={onOpen}>Open Modal</button>
      <AnimatedModal isOpen={isOpen} onClose={onClose} title="My Modal">
        <p>Modal content here</p>
      </AnimatedModal>
    </>
  );
}
```

---

### 4. **Animation Wrappers**

#### FadeIn
```tsx
<FadeIn delay={0.2} triggerOnScroll>
  <div>Content fades in</div>
</FadeIn>
```

#### ScaleIn
```tsx
<ScaleIn delay={0.3}>
  <div>Content scales in</div>
</ScaleIn>
```

#### SlideIn
```tsx
<SlideIn direction="left" delay={0.1}>
  <div>Content slides in from left</div>
</SlideIn>
```

**Directions:** "left" | "right" | "up" | "down"

---

### 5. **Hover Effects**

#### HoverScale
```tsx
<HoverScale>
  <div>Scales on hover</div>
</HoverScale>
```

#### HoverLift
```tsx
<HoverLift>
  <div>Lifts on hover</div>
</HoverLift>
```

---

### 6. **Container Animations**

For staggered children animations:

```tsx
<AnimatedContainer stagger>
  <AnimatedItem>Item 1</AnimatedItem>
  <AnimatedItem>Item 2</AnimatedItem>
  <AnimatedItem>Item 3</AnimatedItem>
</AnimatedContainer>
```

---

### 7. **Special Effects**

#### RevealOnScroll
Animates when element enters viewport:

```tsx
<RevealOnScroll direction="up">
  <div>Reveals when scrolled into view</div>
</RevealOnScroll>
```

#### AnimatedCounter
Number counter with smooth animation:

```tsx
<AnimatedCounter from={0} to={100} duration={2} />
```

#### TypingAnimation
Typewriter effect:

```tsx
<TypingAnimation text="Hello World!" speed={100} />
```

#### AnimatedList
Staggered list animation:

```tsx
<AnimatedList>
  <AnimatedListItem>Item 1</AnimatedListItem>
  <AnimatedListItem>Item 2</AnimatedListItem>
  <AnimatedListItem>Item 3</AnimatedListItem>
</AnimatedList>
```

#### ParallaxScroll
Parallax scrolling effect:

```tsx
<ParallaxScroll speed={0.5}>
  <div>Moves slower than scroll</div>
</ParallaxScroll>
```

---

## 🎭 Animation Variants

Pre-built animation variants in `lib/animations.ts`:

### Fade Animations
- `fadeIn` - Simple fade
- `fadeInUp` - Fade + slide up
- `fadeInDown` - Fade + slide down
- `fadeInLeft` - Fade + slide from left
- `fadeInRight` - Fade + slide from right

### Scale Animations
- `scaleIn` - Scale with fade
- `scaleUp` - Scale only

### Slide Animations
- `slideInLeft` - Slide from left
- `slideInRight` - Slide from right
- `slideInUp` - Slide from bottom
- `slideInDown` - Slide from top

### Stagger Animations
- `staggerContainer` - Container for stagger
- `staggerItem` - Individual stagger items

### Modal Animations
- `modalOverlay` - Modal backdrop
- `modalContent` - Modal content

### Page Animations
- `pageTransition` - Page transition effect

---

## 🪝 Custom Hooks

### useScrollAnimation
Triggers animation when element enters viewport:

```tsx
import { useScrollAnimation } from '@/hooks';

function MyComponent() {
  const { ref, controls, isInView } = useScrollAnimation();
  
  return (
    <motion.div ref={ref} animate={controls} initial="hidden" variants={fadeInUp}>
      Content
    </motion.div>
  );
}
```

### useSequentialAnimation
Delays animation by specified time:

```tsx
import { useSequentialAnimation } from '@/hooks';

function MyComponent() {
  const controls = useSequentialAnimation(500); // 500ms delay
  
  return (
    <motion.div animate={controls} initial="hidden">
      Content
    </motion.div>
  );
}
```

### useHoverAnimation
Manages hover animation state:

```tsx
import { useHoverAnimation } from '@/hooks';

function MyComponent() {
  const { controls, handleHoverStart, handleHoverEnd } = useHoverAnimation();
  
  return (
    <motion.div
      animate={controls}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
    >
      Content
    </motion.div>
  );
}
```

---

## ⚙️ Custom Transitions

Pre-configured transitions in `lib/animations.ts`:

```tsx
import { transitions } from '@/lib/animations';

<motion.div
  animate={{ opacity: 1 }}
  transition={transitions.spring}
>
  Content
</motion.div>
```

**Available transitions:**
- `fast` - 0.2s ease out
- `medium` - 0.4s ease out
- `slow` - 0.6s ease out
- `spring` - Spring physics
- `springBounce` - Bouncy spring

---

## 🎯 Best Practices

### 1. Use Scroll Triggers for Below-the-Fold Content
```tsx
<RevealOnScroll direction="up">
  <Content />
</RevealOnScroll>
```

### 2. Stagger List Items
```tsx
<AnimatedList>
  {items.map(item => (
    <AnimatedListItem key={item.id}>
      {item.content}
    </AnimatedListItem>
  ))}
</AnimatedList>
```

### 3. Add Hover Effects to Interactive Elements
```tsx
<HoverLift>
  <button>Click Me</button>
</HoverLift>
```

### 4. Use Page Transitions
```tsx
import { PageTransition } from '@/components/animated';

export default function MyPage() {
  return (
    <PageTransition>
      <YourPageContent />
    </PageTransition>
  );
}
```

---

## 🎨 Creating Custom Animations

### Using Motion Directly
```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
  transition={{ duration: 0.5 }}
>
  Custom animation
</motion.div>
```

### Creating Custom Variants
```tsx
const customVariant = {
  hidden: { opacity: 0, rotate: -90 },
  visible: { 
    opacity: 1, 
    rotate: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
};

<motion.div
  initial="hidden"
  animate="visible"
  variants={customVariant}
>
  Content
</motion.div>
```

---

## 📊 Performance Tips

1. **Use `will-change` sparingly** - Framer Motion handles this automatically
2. **Prefer transforms over position changes** - Better GPU performance
3. **Use `AnimatePresence` for exit animations**
4. **Reduce motion for accessibility**:

```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
>
  Content
</motion.div>
```

---

## 🌟 Examples

Visit `/animations` route to see live demos of all animation components and effects!

```bash
npm run dev
# Navigate to http://localhost:3000/animations
```

---

## 📚 Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Animation Variants](https://www.framer.com/motion/animation/)
- [Gestures](https://www.framer.com/motion/gestures/)
- [Scroll Animations](https://www.framer.com/motion/scroll-animations/)

---

**Your animation system is fully modular and ready to use! 🎉**
