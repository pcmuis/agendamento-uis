import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

type FirebaseConfigKeys =
  | 'NEXT_PUBLIC_FIREBASE_API_KEY'
  | 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  | 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'NEXT_PUBLIC_FIREBASE_APP_ID';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const keyMap: Record<FirebaseConfigKeys, keyof FirebaseConfig> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'appId',
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let configError: Error | null = null;

const initialiseApp = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (configError) {
    if (typeof window === 'undefined') {
      return null;
    }
    throw configError;
  }

  const config: Partial<FirebaseConfig> = {};
  const missingKeys: FirebaseConfigKeys[] = [];

  (Object.keys(keyMap) as FirebaseConfigKeys[]).forEach((envKey) => {
    const value = process.env[envKey];
    if (!value) {
      missingKeys.push(envKey);
      return;
    }

    const configKey = keyMap[envKey];
    config[configKey] = value;
  });

  if (missingKeys.length > 0) {
    configError = new Error(
      `Configuração do Firebase incompleta. Defina as variáveis: ${missingKeys.join(', ')}`,
    );
    if (typeof window === 'undefined') {
      return null;
    }
    throw configError;
  }

  firebaseApp = getApps().length ? getApps()[0] : initializeApp(config as FirebaseConfig);
  return firebaseApp;
};

export const getFirebaseApp = () => {
  const app = initialiseApp();
  if (!app) {
    throw configError ?? new Error('Firebase não foi inicializado.');
  }
  return app;
};

export const getDb = () => {
  if (!firestore) {
    const app = initialiseApp();
    if (!app) {
      throw configError ?? new Error('Firebase não foi inicializado.');
    }
    firestore = getFirestore(app);
  }
  return firestore;
};

export const getAuthInstance = () => {
  if (!firebaseAuth) {
    const app = initialiseApp();
    if (!app) {
      throw configError ?? new Error('Firebase não foi inicializado.');
    }
    firebaseAuth = getAuth(app);
  }
  return firebaseAuth;
};
