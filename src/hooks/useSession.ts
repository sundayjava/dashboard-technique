"use client";

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionManager } from '@/lib/session';
import toast from 'react-hot-toast';

interface UseSessionOptions {
  /**
   * Redirect path on session expiration
   * @default '/login'
   */
  redirectTo?: string;
  
  /**
   * Show toast notification on logout
   * @default true
   */
  showNotification?: boolean;
  
  /**
   * Callback when session expires
   */
  onSessionExpired?: () => void;
  
  /**
   * How long before expiration (in milliseconds) to silently refresh the session
   * @default 5 * 60 * 1000 (5 minutes)
   */
  warningTime?: number;
}

/**
 * Hook to manage user session with automatic logout on inactivity
 * 
 * Features:
 * - Automatic logout after 30 minutes of inactivity
 * - Session expiration after 24 hours
 * - Activity tracking on user interactions
 * - Warning before session expires
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useSession({
 *     redirectTo: '/login',
 *     onSessionExpired: () => console.log('Session expired')
 *   });
 *   
 *   return <div>Protected content</div>;
 * }
 * ```
 */
export function useSession(options: UseSessionOptions = {}) {
  const {
    redirectTo = '/login',
    showNotification = true,
    onSessionExpired,
    warningTime = 5 * 60 * 1000, // 5 minutes
  } = options;
  
  const router = useRouter();
  const checkIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const refreshInFlightRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  const networkWarningShownRef = useRef(false);
  
  const logout = useCallback((reason: 'inactivity' | 'expired' | 'manual' = 'manual') => {
    SessionManager.clearSession();
    
    if (showNotification) {
      const messages = {
        inactivity: 'You have been logged out due to inactivity.',
        expired: 'Your session has expired. Please log in again.',
        manual: 'You have been logged out.',
      };
      toast.error(messages[reason]);
    }
    
    onSessionExpired?.();
    router.push(redirectTo);
  }, [router, redirectTo, showNotification, onSessionExpired]);
  
  const checkSession = useCallback(() => {
    // Check if session is still valid
    if (!SessionManager.isSessionValid()) {
      const token = SessionManager.getToken();
      if (token) {
        // Session was active but expired
        const isInactive = SessionManager.isInactive();
        logout(isInactive ? 'inactivity' : 'expired');
      } else {
        // No session found
        router.push(redirectTo);
      }
      return;
    }
    
    // Silently extend the session if it's about to expire while the user
    // is still active. Inactivity logout is left alone since refreshing the
    // token can't fix a genuinely idle user.
    const timeUntilExpiration = SessionManager.getTimeUntilExpiration();
    const timeUntilInactivity = SessionManager.getTimeUntilInactivityLogout();

    if (
      timeUntilExpiration <= warningTime &&
      timeUntilExpiration > 0 &&
      timeUntilInactivity > 0 &&
      !refreshInFlightRef.current
    ) {
      refreshInFlightRef.current = true;
      SessionManager.refreshSession().finally(() => {
        refreshInFlightRef.current = false;
      });
    }
  }, [logout, router, redirectTo, warningTime]);
  
  const trackActivity = useCallback(() => {
    // Only track activity if online
    if (isOnline) {
      SessionManager.updateActivity();
    }
  }, [isOnline]);
  
  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Dismiss the offline warning toast
      toast.dismiss('offline-warning');
      if (showNotification && networkWarningShownRef.current) {
        toast.success('Connection restored');
        networkWarningShownRef.current = false;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (showNotification && !networkWarningShownRef.current) {
        toast.error('No internet connection. Your session will be preserved.', {
          duration: Infinity,
          id: 'offline-warning',
        });
        networkWarningShownRef.current = true;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial online status
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Dismiss offline warning if it's still showing
      if (networkWarningShownRef.current) {
        toast.dismiss('offline-warning');
      }
    };
  }, [showNotification]);
  
  useEffect(() => {
    // Initial session check
    checkSession();
    
    // Set up periodic session checking (every 30 seconds)
    checkIntervalRef.current = setInterval(checkSession, 30000);
    
    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, trackActivity);
    });
    
    return () => {
      // Cleanup
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      
      events.forEach(event => {
        window.removeEventListener(event, trackActivity);
      });
    };
  }, [checkSession, trackActivity]);
  
  return {
    logout: () => logout('manual'),
    isSessionValid: SessionManager.isSessionValid(),
    timeUntilExpiration: SessionManager.getTimeUntilExpiration(),
    timeUntilInactivityLogout: SessionManager.getTimeUntilInactivityLogout(),
    isOnline,
  };
}

/**
 * Simple hook for session checking without activity tracking
 * Use this in components that don't need full session management
 */
export function useSessionCheck(redirectTo: string = '/login') {
  const router = useRouter();
  
  useEffect(() => {
    if (!SessionManager.isSessionValid()) {
      router.push(redirectTo);
    }
  }, [router, redirectTo]);
}
