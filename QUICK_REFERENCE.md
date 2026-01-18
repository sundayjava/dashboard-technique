# Quick Reference - Acredis Finance

## 🎨 Tailwind Colors
```tsx
className="bg-primary"      // #c1ff72
className="text-primary"    // #c1ff72
className="bg-black"        // #000000
className="bg-white"        // #ffffff
```

## ✨ Animations (Framer Motion)
```tsx
// Simple fade in
import { FadeIn } from '@/components/animated';
<FadeIn><Content /></FadeIn>

// Scroll-triggered reveal
import { RevealOnScroll } from '@/components/animated';
<RevealOnScroll direction="up"><Content /></RevealOnScroll>

// Animated button
import { AnimatedButton } from '@/components/animated';
<AnimatedButton variant="primary">Click</AnimatedButton>

// Staggered list
import { AnimatedList, AnimatedListItem } from '@/components/animated';
<AnimatedList>
  <AnimatedListItem>Item 1</AnimatedListItem>
  <AnimatedListItem>Item 2</AnimatedListItem>
</AnimatedList>

// Counter animation
import { AnimatedCounter } from '@/components/animated';
<AnimatedCounter to={100} duration={2} />

// Typing effect
import { TypingAnimation } from '@/components/animated';
<TypingAnimation text="Hello!" speed={100} />
```

## 🗃️ Import Paths
```typescript
// Components
import { Button, Input, Card } from '@/components';
import { AnimatedButton, AnimatedCard, FadeIn, RevealOnScroll } from '@/components/animated';

// Stores
import { useAuthStore, useUIStore } from '@/store';

// Hooks
import { useForm, useMediaQuery, useDisclosure, useScrollAnimation } from '@/hooks';

// Utils
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { prisma } from '@/lib/prisma';

// Animations
import { fadeInUp, staggerContainer, transitions } from '@/lib/animations';

// Schemas
import { loginSchema, registerSchema } from '@/schemas/validation.schema';

// Constants
import { ROUTES, API_ROUTES, MESSAGES } from '@/constants';

// Config
import config from '@/config';
```

## 🏪 Zustand Store Usage
```typescript
// Auth Store
const { user, isAuthenticated, login, logout } = useAuthStore();

// UI Store
const { isSidebarOpen, toggleSidebar, openModal, closeModal } = useUIStore();
```

## 📝 Form Validation
```typescript
const { register, handleSubmit, formState: { errors } } = useForm(loginSchema);

<Input {...register('email')} error={errors.email?.message} />
```

## 🔔 Toast Notifications
```typescript
import { toast } from 'react-hot-toast';

toast.success('Success message');
toast.error('Error message');
toast.loading('Loading...');
```

## 💾 Database (Prisma)
```typescript
// Find many
const users = await prisma.user.findMany();

// Find unique
const user = await prisma.user.findUnique({ where: { id: '1' } });

// Create
const user = await prisma.user.create({ 
  data: { email: 'user@example.com', name: 'John' } 
});

// Update
const user = await prisma.user.update({ 
  where: { id: '1' }, 
  data: { name: 'Jane' } 
});

// Delete
await prisma.user.delete({ where: { id: '1' } });
```

## 🌐 API Client
```typescript
// GET
const data = await apiClient.get('/endpoint');

// POST
const data = await apiClient.post('/endpoint', { key: 'value' });

// PUT
const data = await apiClient.put('/endpoint/:id', { key: 'value' });

// DELETE
await apiClient.delete('/endpoint/:id');
```

## 🧩 Component Variants
```tsx
// Button
<Button variant="default">Default</Button>
<Button variant="primary">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button isLoading>Loading</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// Card
<Card variant="default">Default</Card>
<Card variant="bordered">Bordered</Card>
<Card variant="elevated">Elevated</Card>
```

## 🪝 Custom Hooks
```typescript
// Media Queries
const isMobile = useIsMobile();
const isTablet = useIsTablet();
const isDesktop = useIsDesktop();

// Disclosure (Modal/Dropdown)
const { isOpen, onOpen, onClose, onToggle } = useDisclosure();
```

## 📦 Utility Functions
```typescript
// Class merging
cn('class1', 'class2', condition && 'class3');

// Format currency
formatCurrency(1234.56); // "$1,234.56"

// Format date
formatDate(new Date()); // "Jan 13, 2026"

// Truncate text
truncate('Long text here', 10); // "Long text..."
```

## 🛠️ CLI Commands
```bash
# Development
npm run dev

# Database
npm run db:generate    # Generate Prisma Client
npm run db:push        # Push schema to DB
npm run db:studio      # Open Prisma Studio

# Type checking
npm run type-check
```

## 📁 File Organization
```
Create new:
- Components: src/components/[category]/ComponentName.tsx
- Hooks: src/hooks/useHookName.ts
- Stores: src/store/name.store.ts
- Schemas: Add to src/schemas/validation.schema.ts
- API Routes: src/app/api/[route]/route.ts
- Pages: src/app/[route]/page.tsx
```

## 🎯 Common Patterns

### API Route
```typescript
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json({ data: users, success: true });
}
```

### Server Component with DB
```typescript
// src/app/users/page.tsx
import { prisma } from '@/lib/prisma';

export default async function UsersPage() {
  const users = await prisma.user.findMany();
  return <div>{users.map(u => <div key={u.id}>{u.name}</div>)}</div>;
}
```

### Client Component with State
```typescript
'use client';

import { useAuthStore } from '@/store';
import { Button } from '@/components';

export default function DashboardPage() {
  const { user } = useAuthStore();
  return <div>Welcome {user?.name}</div>;
}
```
