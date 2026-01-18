# Project Structure

This project follows a modular architecture for better organization and maintainability.

## Directory Structure

```
src/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
│
├── components/               # React components
│   ├── ui/                   # UI components (Button, Input, Card, etc.)
│   ├── providers/            # Context providers
│   └── index.ts              # Component exports
│
├── config/                   # App configuration
│   └── index.ts              # Configuration constants
│
├── constants/                # Application constants
│   └── index.ts              # Routes, messages, regex, etc.
│
├── hooks/                    # Custom React hooks
│   ├── useForm.ts            # Form handling hook
│   ├── useMediaQuery.ts      # Responsive hooks
│   ├── useDisclosure.ts      # Modal/disclosure hook
│   └── index.ts              # Hook exports
│
├── lib/                      # Utility libraries
│   ├── api-client.ts         # Axios HTTP client
│   ├── prisma.ts             # Prisma client instance
│   └── utils.ts              # Utility functions
│
├── schemas/                  # Validation schemas
│   └── validation.schema.ts  # Yup schemas for forms
│
├── store/                    # Zustand state management
│   ├── auth.store.ts         # Authentication state
│   ├── ui.store.ts           # UI state
│   └── index.ts              # Store exports
│
└── types/                    # TypeScript types
    ├── env.d.ts              # Environment variables
    └── index.ts              # Common types
```

## Key Technologies

- **State Management**: Zustand with devtools and persistence
- **Forms**: React Hook Form + Yup validation
- **Database**: Prisma ORM
- **HTTP Client**: Axios with interceptors
- **Styling**: Tailwind CSS with custom configuration
- **Notifications**: React Hot Toast

## Development Guidelines

### State Management
- Use Zustand stores in `src/store/`
- Keep stores modular and focused
- Use TypeScript interfaces for type safety

### Forms
- Use the `useForm` hook from `src/hooks/useForm.ts`
- Define validation schemas in `src/schemas/`
- Leverage Yup for validation rules

### Components
- UI components in `src/components/ui/`
- Feature components in `src/components/`
- Use the `cn()` utility for className merging

### API Calls
- Use the `apiClient` from `src/lib/api-client.ts`
- API routes in `src/app/api/`
- Follow REST conventions

### Styling
- Tailwind CSS with custom theme
- Primary color: `#c1ff72`
- Font: Inter
- Use design tokens from `tailwind.config.ts`

## Available Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Database
npx prisma generate    # Generate Prisma client
npx prisma db push     # Push schema to database
npx prisma studio      # Open Prisma Studio
```
