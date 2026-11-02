import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types/index.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  demoUserId: string | null;
  personas: User[];
  loginWithGoogle: () => Promise<void>;
  switchPersona: (userId: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [demoUserId, setDemoUserId] = useState<string | null>(() => {
    return localStorage.getItem('bookflow_demo_user_id') || 'usr_admin_1'; // Default to admin for review
  });
  const [personas, setPersonas] = useState<User[]>([]);

  // Authenticated fetch wrapper injecting Authorization or demo headers
  const apiFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || {});

      if (demoUserId) {
        headers.set('x-demo-user-id', demoUserId);
      } else if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [demoUserId, token]
  );

  const fetchPersonas = async () => {
    try {
      const res = await fetch('/api/v1/auth/personas');
      const json = await res.json();
      if (json.success) {
        setPersonas(json.data);
      }
    } catch (e) {
      console.error('Failed to load personas:', e);
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/auth/me');
      const json = await res.json();
      if (json.success && json.data.user) {
        setUser(json.data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('Failed to refresh user:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchPersonas();
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser, demoUserId, token]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setToken(idToken);
        // Clear demo persona if Google login succeeds
        setDemoUserId(null);
        localStorage.removeItem('bookflow_demo_user_id');
      } else {
        setToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const switchPersona = async (newUserId: string | null) => {
    setLoading(true);
    if (newUserId) {
      setDemoUserId(newUserId);
      localStorage.setItem('bookflow_demo_user_id', newUserId);
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } else {
      setDemoUserId(null);
      localStorage.removeItem('bookflow_demo_user_id');
    }
    // refresh will trigger via dependency
  };

  const logout = async () => {
    setDemoUserId(null);
    localStorage.removeItem('bookflow_demo_user_id');
    setUser(null);
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoUserId,
        personas,
        loginWithGoogle,
        switchPersona,
        logout,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
