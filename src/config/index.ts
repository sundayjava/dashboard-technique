/**
 * Application Configuration
 * Centralized configuration values for the application
 */

export const config = {
  app: {
    name: "Acredis Finance",
    description: "Professional finance management platform",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
    timeout: 30000,
  },
  
  auth: {
    tokenKey: "auth-token",
    storageKey: "auth-storage",
  },
  
  pagination: {
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  },
  
  theme: {
    colors: {
      primary: "#c1ff72",
      black: "#000000",
      white: "#ffffff",
    },
  },
} as const;

export * from './sidebar.config';
export default config;
