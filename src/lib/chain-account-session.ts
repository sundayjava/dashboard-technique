/**
 * Chain Account Session Management
 * Separate from user sessions - 8 hour expiry, token-based auth
 */

export interface ChainAccountSessionPayload {
  userId: string;
  chainAccountId: string;
  memberId: string;
  accountName: string;
  role: string;
  iat: number;
  exp: number;
}

const CHAIN_SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const JWT_SECRET = process.env.JWT_SECRET || 'acredis-secret-key-change-in-production';

/**
 * Create a Chain Account session token
 */
export function createChainAccountToken(
  userId: string,
  chainAccountId: string,
  memberId: string,
  accountName: string,
  role: string
): string {
  const now = Date.now();
  const payload: ChainAccountSessionPayload = {
    userId,
    chainAccountId,
    memberId,
    accountName,
    role,
    iat: now,
    exp: now + CHAIN_SESSION_DURATION,
  };
  
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createSignature(encodedPayload);
  
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a Chain Account session token
 */
export function verifyChainAccountToken(token: string): ChainAccountSessionPayload | null {
  try {
    const [encodedPayload, signature] = token.split('.');
    
    // Verify signature
    const expectedSignature = createSignature(encodedPayload);
    if (signature !== expectedSignature) {
      console.error('Invalid Chain Account token signature');
      return null;
    }
    
    // Decode payload
    const payload: ChainAccountSessionPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64').toString('utf-8')
    );
    
    // Check expiration
    if (Date.now() >= payload.exp) {
      console.error('Chain Account token expired');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Chain Account token verification failed:', error);
    return null;
  }
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
 * Client-side Chain Account session management
 */
export class ChainAccountSessionManager {
  private static readonly TOKEN_KEY = 'chain_account_token';
  private static readonly SESSION_KEY = 'chain_account_session';
  
  static setSession(token: string, session: any): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event('chain-account-login'));
  }
  
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  static getSession(): any | null {
    if (typeof window === 'undefined') return null;
    
    const sessionStr = localStorage.getItem(this.SESSION_KEY);
    if (!sessionStr) return null;
    
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  }
  
  static clearSession(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    window.dispatchEvent(new Event('chain-account-logout'));
  }
  
  static isSessionValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    const payload = verifyChainAccountToken(token);
    if (!payload) {
      this.clearSession();
      return false;
    }
    
    return true;
  }
  
  static getTimeUntilExpiration(): number {
    const token = this.getToken();
    if (!token) return 0;
    
    const payload = verifyChainAccountToken(token);
    if (!payload) return 0;
    
    return Math.max(0, payload.exp - Date.now());
  }
}
