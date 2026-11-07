'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { getDb } from '../lib/firebase';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin123';
const SESSION_KEY = 'uis-auth-user';

type Credentials = {
  username: string;
  salt: string;
  passwordHash: string;
};

const hashPassword = async (password: string, salt: string) => {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const ensureDefaultCredentials = async () => {
  const db = getDb();
  const credentialsRef = doc(db, 'configuracoes', 'autenticacao');

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(credentialsRef);
    if (!snapshot.exists()) {
      const salt = crypto.randomUUID();
      const passwordHash = await hashPassword(DEFAULT_PASSWORD, salt);
      transaction.set(credentialsRef, {
        username: DEFAULT_USERNAME,
        salt,
        passwordHash,
      } satisfies Credentials);
    }
  });
};

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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await ensureDefaultCredentials();
        setUser(sessionStorage.getItem(SESSION_KEY));
      } catch (error) {
        console.error('Não foi possível inicializar as credenciais no Firestore.', error);
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    await ensureDefaultCredentials();
    const credentialsSnapshot = await getDoc(doc(getDb(), 'configuracoes', 'autenticacao'));
    const credentials = credentialsSnapshot.data() as Credentials | undefined;

    if (!credentials || credentials.username !== username) {
      throw new Error('Credenciais inválidas.');
    }

    const passwordHash = await hashPassword(password, credentials.salt);
    if (passwordHash !== credentials.passwordHash) {
      throw new Error('Credenciais inválidas.');
    }

    sessionStorage.setItem(SESSION_KEY, credentials.username);
    setUser(credentials.username);
  };

  const logout = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
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
