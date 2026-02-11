import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from '@/lib/session';

export interface AuthenticatedRequest extends NextRequest {
  user?: SessionPayload;
}

/**
 * Authentication middleware for API routes
 * Verifies the session token and attaches user info to the request
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ success: true; user: SessionPayload } | { success: false; response: NextResponse }> {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;

    if (!token) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Authentication required', code: 'NO_TOKEN' },
          { status: 401 }
        ),
      };
    }

    // Verify token
    const payload = verifySessionToken(token);
    
    if (!payload) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid or expired session. Please log in again.', code: 'INVALID_TOKEN' },
          { status: 401 }
        ),
      };
    }

    return { success: true, user: payload };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ success: true; user: SessionPayload } | { success: false; response: NextResponse }> {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.success) {
    return authResult;
  }

  if (authResult.user.role !== 'ADMIN') {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Admin access required', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Helper to extract user ID from request
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;

  if (!token) return null;

  const payload = verifySessionToken(token);
  return payload?.userId || null;
}
