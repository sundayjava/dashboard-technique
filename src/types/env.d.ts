/**
 * Environment Variables Type Definitions
 * Ensures type-safe access to environment variables
 */

interface EnvironmentVariables {
  // Database
  DATABASE_URL: string;
  
  // API
  NEXT_PUBLIC_API_URL?: string;
  
  // Auth
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;
  
  // Add more as needed
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentVariables {}
  }
}

export {};
