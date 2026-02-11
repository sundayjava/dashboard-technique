import { sign, verify } from 'crypto';

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  iat: number; // Issued at
  exp: number; // Expiration
}

const JWT_SECRET = process.env.JWT_SECRET || 'acredis-secret-key-change-in-production';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_THRESHOLD = 2 * 60 * 60 * 1000; // Refresh if less than 2 hours remain

/**
 * Create a simple JWT-like token
 * Note: For production, use a proper JWT library like 'jsonwebtoken'
 */
export function createSessionToken(userId: string, email: string, role: string): string {
  const now = Date.now();
  const payload: SessionPayload = {
    userId,
    email,
    role,
    iat: now,
    exp: now + SESSION_DURATION,
  };
  
  // In production, use a proper JWT library
  // For now, we'll use base64 encoding with a signature
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createSignature(encodedPayload);
  
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encodedPayload, signature] = token.split('.');
    
    // Verify signature
    const expectedSignature = createSignature(encodedPayload);
    if (signature !== expectedSignature) {
      console.error('Invalid token signature');
      return null;
    }
    
    // Decode payload
    const payload: SessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64').toString('utf-8')
    );
    
    // Check expiration
    if (Date.now() >= payload.exp) {
      console.error('Token expired');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Check if token needs refresh
 */
export function shouldRefreshToken(token: string): boolean {
  const payload = verifySessionToken(token);
  if (!payload) return false;
  
  const timeRemaining = payload.exp - Date.now();
  return timeRemaining < REFRESH_THRESHOLD;
}

/**
 * Create a signature for the payload
 */
function createSignature(data: string): string {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64');
}

/**
 * Client-side session management
 */
export class SessionManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'user';
  private static readonly LAST_ACTIVITY_KEY = 'last_activity';
  private static readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  static setSession(token: string, user: any): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.updateActivity();
  }
  
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  static getUser(): any | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  
  static clearSession(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
  }
  
  static isSessionValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // Verify token
    const payload = verifySessionToken(token);
    if (!payload) {
      this.clearSession();
      return false;
    }
    
    // Check inactivity
    if (this.isInactive()) {
      this.clearSession();
      return false;
    }
    
    return true;
  }
  
  static updateActivity(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
  }
  
  static getLastActivity(): number {
    if (typeof window === 'undefined') return Date.now();
    
    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY);
    return lastActivity ? parseInt(lastActivity, 10) : Date.now();
  }
  
  static isInactive(): boolean {
    const lastActivity = this.getLastActivity();
    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity >= this.INACTIVITY_TIMEOUT;
  }
  
  static getTimeUntilExpiration(): number {
    const token = this.getToken();
    if (!token) return 0;
    
    const payload = verifySessionToken(token);
    if (!payload) return 0;
    
    return Math.max(0, payload.exp - Date.now());
  }
  
  static getTimeUntilInactivityLogout(): number {
    const lastActivity = this.getLastActivity();
    const timeSinceActivity = Date.now() - lastActivity;
    return Math.max(0, this.INACTIVITY_TIMEOUT - timeSinceActivity);
  }
}
