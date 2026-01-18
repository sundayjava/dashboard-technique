# Header System Documentation

## Overview
The header system is built with a modular approach, allowing multiple header variants (Header1, Header2, etc.) to be used throughout the application.

## Header1 Features

### ✅ Completed Features

1. **Navigation Items**
   - Acredis finance (Home)
   - Acredis plus
   - Banking
   - Products (with dropdown submenu)
     - Investment Strategy
   - About
   - Contact
   - News

2. **Authentication**
   - Login button
   - Create Account button (primary styled)

3. **Responsive Design**
   - Desktop: Full navigation bar with hover dropdowns
   - Mobile: Drawer/sidebar navigation
   - Tablet: Optimized for medium screens

4. **Theme Switcher**
   - Light/Dark mode toggle
   - Persists user preference in localStorage
   - Smooth transitions between themes
   - Icon animations

5. **Animations & Effects**
   - Scroll-based header background change
   - Smooth dropdown animations
   - Mobile drawer slide-in animation
   - Hover effects on navigation items
   - Logo hover scale effect

6. **Mobile Drawer Features**
   - Slides in from right side
   - Backdrop with blur effect
   - Expandable submenu (Products)
   - Auth buttons at bottom
   - Closes on navigation or ESC key
   - Body scroll lock when open

## File Structure

```
src/components/layout/
├── Header1.tsx         # Main header component
├── MobileDrawer.tsx    # Mobile navigation drawer
├── ThemeToggle.tsx     # Theme switcher button
└── index.ts           # Exports
```

## Usage

### Basic Implementation

```tsx
import { Header1 } from "@/components/layout";

export default function Layout({ children }) {
  return (
    <>
      <Header1 />
      {children}
    </>
  );
}
```

### Creating Additional Header Variants

To create Header2, Header3, etc.:

1. Copy `Header1.tsx` to `Header2.tsx`
2. Modify the navigation items, styling, or layout
3. Export from `index.ts`
4. Use in your layout:

```tsx
import { Header2 } from "@/components/layout";
```

## Customization

### Navigation Items

Edit the `navItems` array in `Header1.tsx`:

```tsx
const navItems: NavItem[] = [
  { label: "Label", href: "/path" },
  { 
    label: "Label with Submenu", 
    href: "/path",
    submenu: [
      { label: "Submenu Item", href: "/path/sub" },
    ]
  },
];
```

### Styling

- Primary color (lime green): `#c1ff72`
- Background transitions based on scroll
- All styling uses Tailwind CSS utility classes
- Responsive breakpoints: `lg:` (1024px+)

### Theme Configuration

The theme toggle supports:
- Light mode (default)
- Dark mode
- System preference detection
- localStorage persistence

## Navigation Routes

All navigation routes have placeholder pages:

- `/` - Home
- `/acredis-plus` - Acredis Plus
- `/banking` - Banking Services
- `/products` - Products Overview
- `/products/investment-strategy` - Investment Strategy
- `/about` - About Us
- `/contact` - Contact
- `/news` - News
- `/login` - Login Page
- `/create-account` - Create Account Page

## Responsive Breakpoints

- **Mobile**: < 1024px - Shows hamburger menu, drawer navigation
- **Desktop**: ≥ 1024px - Shows full horizontal navigation

## Accessibility

- ARIA labels on interactive buttons
- Keyboard navigation support (ESC to close drawer)
- Focus management
- Semantic HTML structure

## Performance Optimizations

- Framer Motion animations (GPU accelerated)
- Component-level code splitting
- Optimized re-renders with React.useState
- Efficient scroll listeners with cleanup

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

Potential additions for future header variants:

- Mega menu for products
- Search functionality
- User profile dropdown
- Notification bell
- Language switcher
- Breadcrumb navigation
- Sticky sub-navigation
- Progress indicator on scroll
