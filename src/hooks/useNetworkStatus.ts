"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface UseNetworkStatusOptions {
  /**
   * Show toast notifications on network status change
   * @default true
   */
  showNotification?: boolean;
  
  /**
   * Callback when network goes online
   */
  onOnline?: () => void;
  
  /**
   * Callback when network goes offline
   */
  onOffline?: () => void;
}

/**
 * Hook to monitor network status and provide real-time connectivity information
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, isSlowConnection } = useNetworkStatus({
 *     showNotification: true,
 *     onOffline: () => console.log('Lost connection')
 *   });
 *   
 *   return (
 *     <div>
 *       {!isOnline && <Banner>You are offline</Banner>}
 *       {isSlowConnection && <Banner>Slow connection detected</Banner>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const {
    showNotification = true,
    onOnline,
    onOffline,
  } = options;
  
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [effectiveType, setEffectiveType] = useState<string>('4g');
  const [downlink, setDownlink] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Initialize online status
    setIsOnline(navigator.onLine);

    // Check network connection type if available
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      setEffectiveType(connection.effectiveType || '4g');
      setDownlink(connection.downlink);
      
      // Consider 2g or slow-2g as slow connection
      setIsSlowConnection(
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g'
      );
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (showNotification) {
        toast.success('Connection restored', {
          icon: '🌐',
          duration: 3000,
        });
      }
      onOnline?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (showNotification) {
        toast.error('No internet connection', {
          icon: '📡',
          duration: Infinity,
          id: 'network-offline',
        });
      }
      onOffline?.();
    };

    const handleConnectionChange = () => {
      if (connection) {
        const newEffectiveType = connection.effectiveType || '4g';
        setEffectiveType(newEffectiveType);
        setDownlink(connection.downlink);
        
        const isSlow = newEffectiveType === 'slow-2g' || newEffectiveType === '2g';
        setIsSlowConnection(isSlow);
        
        if (isSlow && showNotification) {
          toast('Slow connection detected', {
            icon: '🐌',
            duration: 4000,
          });
        }
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      // Cleanup
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      
      // Dismiss offline notification if still showing
      toast.dismiss('network-offline');
    };
  }, [showNotification, onOnline, onOffline]);

  return {
    isOnline,
    isSlowConnection,
    effectiveType,
    downlink,
    connectionQuality: isSlowConnection ? 'slow' : isOnline ? 'good' : 'offline',
  };
}

/**
 * Simple hook to just check if online without notifications
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
