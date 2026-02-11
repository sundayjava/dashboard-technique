"use client";

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NetworkStatusIndicatorProps {
  /**
   * Show full-page overlay when offline
   * @default true
   */
  showOverlay?: boolean;
}

/**
 * Visual indicator showing current network status with optional full-page overlay
 * 
 * @example
 * ```tsx
 * // In your layout or main component
 * <NetworkStatusIndicator showOverlay />
 * ```
 */
export function NetworkStatusIndicator({ 
  showOverlay = true,
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, effectiveType } = useNetworkStatus({
    showNotification: false, // We'll show our own indicator
  });

  return (
    <>
      {/* Full-page overlay when offline */}
      <AnimatePresence>
        {!isOnline && showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 bg-black/60 backdrop-blur-md flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl"
            >
              <div className="text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                  <WifiOff className="w-10 h-10 text-red-600" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  No Internet Connection
                </h2>

                {/* Description */}
                <p className="text-gray-600 mb-6">
                  Please check your internet connection and try again. Your session will be preserved while you're offline.
                </p>

                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Waiting for connection...</span>
                </div>

                {/* Retry hint */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    The page will automatically resume once your connection is restored
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow connection indicator (top of page) */}
      <AnimatePresence>
        {isOnline && isSlowConnection && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <div className="bg-yellow-500 text-white px-4 py-3 shadow-lg">
              <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                <Activity className="w-5 h-5 animate-pulse" />
                <span className="font-medium">
                  Slow connection detected ({effectiveType}) - Some features may be slower
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Small status indicator (bottom-right corner) - Always visible */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm text-sm font-medium
          transition-all duration-300
          ${!isOnline 
            ? 'bg-red-500/90 text-white' 
            : isSlowConnection 
              ? 'bg-yellow-500/90 text-white'
              : 'bg-green-500/90 text-white'
          }
        `}>
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Offline</span>
            </>
          ) : isSlowConnection ? (
            <>
              <Activity className="w-4 h-4 animate-pulse" />
              <span>Slow</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4" />
              <span>Online</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
