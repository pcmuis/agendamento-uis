import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
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

  const envConfig = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as const;

  const missingKeys = (Object.keys(envConfig) as Array<keyof typeof envConfig>).filter(
    (key) => !envConfig[key],
  );

  if (missingKeys.length > 0) {
    configError = new Error(
      `Configuração do Firebase incompleta. Defina as variáveis: ${missingKeys.join(', ')}`,
    );
    if (typeof window === 'undefined') {
      return null;
    }
    throw configError;
  }

  const config: FirebaseConfig = {
    apiKey: envConfig.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: envConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: envConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: envConfig.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: envConfig.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  firebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
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
