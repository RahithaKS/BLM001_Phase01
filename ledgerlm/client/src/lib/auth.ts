import { useState, useEffect } from 'react';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

const AUTH_STORAGE_KEY = 'ledgerlm_user';
const AUTH_CHANGE_EVENT = 'ledgerlm_auth_change';

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  // Dispatch event to notify all components of auth change
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthUser(): AuthUser | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Dispatch event to notify all components of auth change
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/**
 * React hook that provides reactive access to current auth user
 * Updates automatically when user logs in/out
 */
export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());

  useEffect(() => {
    // Update user when auth changes (login/logout)
    const handleAuthChange = () => {
      setUser(getAuthUser());
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    
    // Also listen to storage events (for multi-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === AUTH_STORAGE_KEY) {
        setUser(getAuthUser());
      }
    });

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return user;
}
