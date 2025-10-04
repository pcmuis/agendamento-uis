'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { getAuthInstance } from '../lib/firebase';

type AuthContextType = {
  user: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authClient, setAuthClient] = useState<Auth | null>(null);

  useEffect(() => {
    try {
      const instance = getAuthInstance();
      setAuthClient(instance);

      const unsubscribe = onAuthStateChanged(instance, (firebaseUser) => {
        setUser(firebaseUser ? firebaseUser.email : null);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase não configurado corretamente.', error);
      setLoading(false);
      return undefined;
    }
  }, []);

  const login = async (email: string, password: string) => {
    if (!authClient) {
      throw new Error('Firebase Auth não está disponível. Verifique a configuração.');
    }
    await signInWithEmailAndPassword(authClient, email, password);
  };

  const logout = async () => {
    if (!authClient) {
      throw new Error('Firebase Auth não está disponível. Verifique a configuração.');
    }
    await signOut(authClient);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
