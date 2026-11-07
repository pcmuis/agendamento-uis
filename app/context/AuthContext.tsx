'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { getDb } from '../lib/firebase';

const SESSION_KEY = 'uis-auth-user';
const CREDENTIALS_PATH = ['configuracoes1', 'autenticacao1'] as const;

type Credentials = {
  username: string;
  salt: string;
  passwordHash: string;
};

type CredentialStatus = 'checking' | 'unconfigured' | 'configured' | 'error';

const hashPassword = async (password: string, salt: string) => {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

type AuthContextType = {
  user: string | null;
  credentialStatus: CredentialStatus;
  login: (username: string, password: string) => Promise<void>;
  setupCredentials: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>('checking');

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const credentialsSnapshot = await getDoc(doc(getDb(), ...CREDENTIALS_PATH));
        if (credentialsSnapshot.exists()) {
          setCredentialStatus('configured');
          setUser(sessionStorage.getItem(SESSION_KEY));
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          setCredentialStatus('unconfigured');
        }
      } catch (error) {
        console.error('Não foi possível consultar as credenciais no Firestore.', error);
        setCredentialStatus('error');
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const credentialsSnapshot = await getDoc(doc(getDb(), ...CREDENTIALS_PATH));
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

  const setupCredentials = async (username: string, password: string) => {
    const db = getDb();
    const credentialsRef = doc(db, ...CREDENTIALS_PATH);
    const salt = crypto.randomUUID();
    const passwordHash = await hashPassword(password, salt);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(credentialsRef);
      if (snapshot.exists()) {
        throw new Error('As credenciais já foram cadastradas.');
      }

      transaction.set(credentialsRef, { username, salt, passwordHash } satisfies Credentials);
    });

    setCredentialStatus('configured');
    sessionStorage.setItem(SESSION_KEY, username);
    setUser(username);
  };

  const logout = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, credentialStatus, login, setupCredentials, logout, loading }}>
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
