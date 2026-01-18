#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Acredis Finance - Project Setup Script                ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please create a .env file with the following variables:${NC}"
    echo ""
    echo "DATABASE_URL=your_postgresql_connection_string"
    echo "NEXTAUTH_SECRET=your_secret_key"
    echo "NEXTAUTH_URL=http://localhost:3000"
    echo ""
    exit 1
fi

echo -e "${BLUE}📦 Step 1: Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
echo ""

echo -e "${BLUE}🗄️  Step 2: Setting up database schema...${NC}"
npx prisma db push
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to push database schema${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database schema synchronized${NC}"
echo ""

echo -e "${BLUE}🔧 Step 3: Generating Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to generate Prisma Client${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

echo -e "${BLUE}🏦 Step 4: Seeding banks...${NC}"
npx ts-node prisma/seed-banks.ts
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Failed to seed banks (you can do this manually later)${NC}"
else
    echo -e "${GREEN}✅ Banks seeded successfully${NC}"
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Completed Successfully! 🎉                  ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Run ${YELLOW}npm run dev${NC} to start the development server"
echo -e "  2. Open ${YELLOW}http://localhost:3000${NC} in your browser"
echo ""
echo -e "${BLUE}Additional commands:${NC}"
echo -e "  • View database: ${YELLOW}npx prisma studio${NC}"
echo -e "  • Re-seed banks: ${YELLOW}npx ts-node prisma/seed-banks.ts${NC}"
echo -e "  • Build for production: ${YELLOW}npm run build${NC}"
echo ""
