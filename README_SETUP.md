# Acredis Finance - Setup Guide

Complete guide for setting up the project on a new computer.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **PostgreSQL** database - [Download](https://www.postgresql.org/download/) or use a cloud service like:
  - [Neon](https://neon.tech/)
  - [Supabase](https://supabase.com/)
  - [Railway](https://railway.app/)
  - [Render](https://render.com/)
- **Git** (optional, for version control) - [Download](https://git-scm.com/)

## Quick Setup (Automated)

### For Linux/Mac:

```bash
# Make the script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

### For Windows:

```cmd
# Double-click setup.bat or run in Command Prompt
setup.bat
```

## Manual Setup

If the automated script doesn't work, follow these steps:

### 1. Clone/Download the Project

```bash
git clone <repository-url>
cd acredisfinance
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here-generate-using-openssl"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Email configuration (for notifications)
EMAIL_SERVER_USER="your-email@example.com"
EMAIL_SERVER_PASSWORD="your-email-password"
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_FROM="noreply@acredisfinance.com"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Database Setup

#### Option A: Using Prisma DB Push (Recommended for development)

```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

#### Option B: Using Migrations (Recommended for production)

```bash
# Create and run migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 5. Seed the Database

```bash
# Seed banks
npx ts-node prisma/seed-banks.ts
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Management

### View Database (Prisma Studio)

```bash
npx prisma studio
```

This opens a GUI at [http://localhost:5555](http://localhost:5555) to view and edit your database.

### Reset Database (⚠️ Warning: Deletes all data)

```bash
npx prisma migrate reset
```

### Re-seed Banks

```bash
npx ts-node prisma/seed-banks.ts
```

## Production Build

### Build the Application

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Common Issues & Solutions

### Issue: "Module not found" errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prisma Client errors

**Solution:**
```bash
npx prisma generate
```

### Issue: Database connection errors

**Solution:**
1. Check your `DATABASE_URL` in `.env`
2. Ensure PostgreSQL is running
3. Verify database credentials
4. Check firewall/network settings

### Issue: Port 3000 already in use

**Solution:**
```bash
# Kill process on port 3000
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- -p 3001
```

### Issue: TypeScript errors

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run dev
```

## Project Structure

```
acredisfinance/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed-banks.ts          # Bank seeding script
│   └── migrations/            # Migration files
├── src/
│   ├── app/                   # Next.js app directory
│   │   ├── api/               # API routes
│   │   ├── dashboard/         # Dashboard pages
│   │   └── ...
│   ├── components/            # React components
│   ├── lib/                   # Utility functions
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript types
├── public/                    # Static files
├── .env                       # Environment variables (create this)
├── setup.sh                   # Setup script (Linux/Mac)
├── setup.bat                  # Setup script (Windows)
└── package.json               # Dependencies
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open database GUI |
| `npx prisma db push` | Sync schema to database |
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma migrate dev` | Create and run migration |

## Support

If you encounter any issues not covered here:

1. Check the error message carefully
2. Search for the error in the project documentation
3. Check the [Next.js documentation](https://nextjs.org/docs)
4. Check the [Prisma documentation](https://www.prisma.io/docs)
5. Contact the development team

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to version control
- Keep your `NEXTAUTH_SECRET` secure
- Use strong database passwords
- Enable SSL for database connections in production
- Regularly update dependencies

## Next Steps

After setup:

1. Create an admin user account
2. Configure email settings
3. Customize branding/logo
4. Review and update bank list
5. Test all features
6. Set up monitoring and logging (production)

---

**Last Updated:** January 2026
