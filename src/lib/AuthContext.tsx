'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { app, lazyFirebaseAuth } from './firebase';

interface AuthContextType {
  user: User | null;
  userId: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** EH Universe 네트워크 API 등에 Bearer로 전달 */
  getIdToken: () => Promise<string | null>;
  isConfigured: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userId: null,
  loading: true,
  signInWithGoogle: async () => {
    throw new Error('AuthProvider not mounted');
  },
  signOut: async () => {
    throw new Error('AuthProvider not mounted');
  },
  getIdToken: async () => {
    throw new Error('AuthProvider not mounted');
  },
  isConfigured: false,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = app !== null;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    lazyFirebaseAuth().then((resolvedAuth) => {
      if (!resolvedAuth) {
        setLoading(false);
        return;
      }
      import('firebase/auth').then(({ onAuthStateChanged, getRedirectResult }) => {
        getRedirectResult(resolvedAuth).catch(() => {});
        unsubscribe = onAuthStateChanged(resolvedAuth, (u) => {
          setUser(u);
          setLoading(false);
        });
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const resolvedAuth = await lazyFirebaseAuth();
    if (!resolvedAuth) {
      setError('Firebase가 초기화되지 않았습니다. 환경변수를 확인해주세요.');
      return;
    }
    setError(null);
    try {
      const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(resolvedAuth, provider);
        return;
      }
      await signInWithPopup(resolvedAuth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      const msg = (err as { message?: string })?.message ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError(`로그인 실패: ${code || msg}`);
      console.error('[Auth] signInWithGoogle', code, msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    const resolvedAuth = await lazyFirebaseAuth();
    if (!resolvedAuth) return;
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(resolvedAuth);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const resolvedAuth = await lazyFirebaseAuth();
    const u = resolvedAuth?.currentUser;
    if (!u) return null;
    return u.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.uid ?? null,
        loading,
        signInWithGoogle,
        signOut,
        getIdToken,
        isConfigured,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
