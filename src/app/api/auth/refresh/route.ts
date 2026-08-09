import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { createSessionToken } from '@/lib/session';

// POST - Issue a fresh session token for an already-authenticated user
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    return authResult.response;
  }

  const { userId, email, role } = authResult.user;
  const token = createSessionToken(userId, email, role);

  return NextResponse.json({ token });
}
