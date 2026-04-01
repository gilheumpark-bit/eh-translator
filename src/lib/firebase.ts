import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

const FIREBASE_ENV =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_ENV : undefined) ?? 'production';

export const isTestEnvironment = FIREBASE_ENV === 'test' || FIREBASE_ENV === 'development';

const productionConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

const testConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_TEST_API_KEY ?? productionConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_TEST_AUTH_DOMAIN ?? productionConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_TEST_PROJECT_ID ?? productionConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_TEST_STORAGE_BUCKET ?? productionConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_TEST_MESSAGING_SENDER_ID ?? productionConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_TEST_APP_ID ?? productionConfig.appId,
};

const firebaseConfig = isTestEnvironment ? testConfig : productionConfig;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter((k) => !firebaseConfig[k]);

  if (missing.length > 0) {
    console.warn('[EH Translator] Firebase config incomplete — missing:', missing.join(', '), 'Auth disabled.');
  } else {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
}

export { auth, app };

export async function lazyFirebaseAuth(): Promise<Auth | null> {
  if (auth) return auth;
  if (!app) return null;
  const { getAuth } = await import('firebase/auth');
  auth = getAuth(app);
  return auth;
}

export function collectionName(name: string): string {
  return isTestEnvironment ? `test_${name}` : name;
}
