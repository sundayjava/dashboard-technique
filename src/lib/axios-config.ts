import axios from 'axios';
import { SessionManager } from './session';
import toast from 'react-hot-toast';

/**
 * Guard so this can be called from anywhere without stacking interceptors.
 *
 * It used to be installed only from a useEffect in the root layout. React
 * runs effects bottom-up, so a page that fetched on mount sent its FIRST
 * request before the interceptor existed -- with no Authorization header.
 * That request 401'd and bounced the user to the login page on every hard
 * refresh. Installing it at module load, and letting any caller ask for it,
 * removes the ordering dependency entirely.
 */
let interceptorsInstalled = false;

/**
 * Configure axios to automatically include auth token in requests
 * and handle session expiration and network errors
 */
export function setupAxiosInterceptors() {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;
  // Request interceptor - add auth token to all requests
  axios.interceptors.request.use(
    (config) => {
      // Skip auto-auth for Chain Account routes if Authorization is already set
      // Chain Account routes manage their own tokens
      const isChainAccountRoute = config.url?.includes('/api/chain-account/');
      const hasAuthHeader = config.headers.Authorization;

      if (isChainAccountRoute && hasAuthHeader) {
        // Don't override - Chain Account routes have their own token
        return config;
      }

      // For all other routes, add the regular user session token
      const token = SessionManager.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle 401 errors (session expired) and network errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Network error (no response from server)
      if (!error.response) {
        // Check if it's a network error
        if (error.message === 'Network Error' || !navigator.onLine) {
          toast.error('Network error. Please check your internet connection.', {
            id: 'network-error',
            duration: 5000,
          });
        } else if (error.code === 'ECONNABORTED') {
          toast.error('Request timeout. Please try again.', {
            id: 'timeout-error',
            duration: 4000,
          });
        }
        return Promise.reject(error);
      }

      // Handle authentication errors
      if (error.response?.status === 401) {
        const errorCode = error.response?.data?.code;
        
        // If the error is due to invalid/expired token, clear session and redirect
        if (errorCode === 'INVALID_TOKEN' || errorCode === 'NO_TOKEN') {
          SessionManager.clearSession();
          
          // Only redirect if not already on auth pages
          if (typeof window !== 'undefined' && 
              !window.location.pathname.startsWith('/login') &&
              !window.location.pathname.startsWith('/create-account') &&
              !window.location.pathname.startsWith('/verify-')) {
            window.location.href = '/login';
          }
        }
      }

      // Handle server errors
      if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later.', {
          id: 'server-error',
          duration: 4000,
        });
      }

      return Promise.reject(error);
    }
  );
}

// Install on import. Anything that imports this module -- directly or through
// a component that needs authenticated requests -- is covered before its first
// render, rather than depending on an effect having run.
setupAxiosInterceptors();
